// functions/api/contact.js
//
// Recibe el envío de cualquiera de los 2 formularios de contacto.html
// (form_type = "mensaje" o "reunion"), valida Turnstile en el servidor,
// guarda el contacto en D1 (fuente de verdad) y encola la sincronización
// con Notion. Nunca llama a Notion directamente desde acá — eso lo hace
// el Worker consumidor de la cola, para poder reintentar sin perder el envío.

const CAMPOS_PERMITIDOS = [
  'form_type', 'nombre', 'empresa', 'email', 'telefono', 'mensaje',
  'presupuesto', 'consent_marketing', 'dias', 'horario',
  'cf-turnstile-response', 'botcheck',
];

const MAX_LARGO = {
  nombre: 200, empresa: 200, email: 200, telefono: 60,
  mensaje: 5000, presupuesto: 200, dias: 200, horario: 100,
};

function textoLimpio(valor, maxLargo) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, maxLargo);
}

async function verificarTurnstile(token, secretKey, ip) {
  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token || '');
  if (ip) body.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  return data.success === true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Validar Origin (evita que otros sitios usen este endpoint directamente)
  const origin = request.headers.get('Origin') || '';
  const origenesPermitidos = ['https://solazstudio.cl', 'https://www.solazstudio.cl'];
  if (origin && !origenesPermitidos.includes(origin)) {
    return new Response(JSON.stringify({ ok: false, error: 'origen_no_permitido' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'formato_invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Honeypot — si el campo trampa viene lleno, es un bot. Respondemos
  // éxito falso (para no delatar la trampa) pero no guardamos nada.
  const botcheck = form.get('botcheck');
  if (botcheck) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Lista blanca de campos — cualquier otro campo se ignora
  const datos = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    datos[campo] = form.get(campo);
  }
  // dias[] puede venir repetido (checkboxes) — juntar todos los valores
  const diasSeleccionados = form.getAll('dias[]').filter(Boolean);
  if (diasSeleccionados.length) {
    datos.dias = diasSeleccionados.join(', ');
  }

  const formType = datos.form_type === 'reunion' ? 'reunion' : 'mensaje';

  // 4. Verificar Turnstile en el servidor (obligatorio, nunca confiar solo en el navegador)
  const ip = request.headers.get('CF-Connecting-IP');
  const turnstileOk = await verificarTurnstile(datos['cf-turnstile-response'], env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileOk) {
    return new Response(JSON.stringify({ ok: false, error: 'verificacion_fallida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. Limpiar y validar campos según el tipo de formulario
  const nombre = textoLimpio(datos.nombre, MAX_LARGO.nombre);
  const email = textoLimpio(datos.email, MAX_LARGO.email);
  const telefono = textoLimpio(datos.telefono, MAX_LARGO.telefono);
  const empresa = textoLimpio(datos.empresa, MAX_LARGO.empresa);

  if (!nombre || !email) {
    return new Response(JSON.stringify({ ok: false, error: 'faltan_campos_obligatorios' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) {
    return new Response(JSON.stringify({ ok: false, error: 'email_invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let mensaje = '';
  let presupuesto = null;
  let dias = null;
  let horario = null;

  if (formType === 'mensaje') {
    mensaje = textoLimpio(datos.mensaje, MAX_LARGO.mensaje);
    presupuesto = textoLimpio(datos.presupuesto, MAX_LARGO.presupuesto) || null;
    if (!mensaje) {
      return new Response(JSON.stringify({ ok: false, error: 'faltan_campos_obligatorios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    dias = textoLimpio(datos.dias, MAX_LARGO.dias) || null;
    horario = textoLimpio(datos.horario, MAX_LARGO.horario) || null;
    const partes = ['Solicita reunión.'];
    if (dias) partes.push(`Días: ${dias}.`);
    if (horario) partes.push(`Horario: ${horario}.`);
    mensaje = partes.join(' ');
  }

  const consentMarketing = datos.consent_marketing === 'si' ? 1 : 0;
  const id = crypto.randomUUID();
  const origenUrl = request.headers.get('Referer') || null;

  // 6. Guardar en D1 primero — solo devolvemos éxito si esto funciona
  try {
    await env.DB.prepare(
      `INSERT INTO contacts
        (id, form_type, nombre, empresa, email, telefono, mensaje, presupuesto,
         consent_marketing, dias, horario, origen_url, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      id, formType, nombre, empresa || null, email, telefono || null, mensaje,
      presupuesto, consentMarketing, dias, horario, origenUrl
    ).run();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'error_guardando' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 7. Encolar la sincronización con Notion (si esto falla, el contacto
  // igual quedó guardado en D1 — la reconciliación periódica lo va a
  // encontrar y reintentar más tarde).
  try {
    await env.CONTACT_QUEUE.send({ id });
  } catch (err) {
    // No hacemos fallar la respuesta por esto — D1 ya tiene el contacto.
  }

  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
