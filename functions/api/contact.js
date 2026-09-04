// functions/api/contact.js
//
// Recibe los dos recorridos de contacto, valida Turnstile y guarda primero
// en D1. Solo una inserción nueva se encola para sincronización posterior.

import services from '../../src/_data/services.js';

const ORIGENES_PERMITIDOS = new Set([
  'https://solazstudio.cl',
  'https://www.solazstudio.cl',
]);

const SERVICE_CODES = new Set(services.map(({ code }) => code));

const CAMPOS_PERMITIDOS = [
  'form_type', 'nombre', 'empresa', 'email', 'telefono', 'mensaje',
  'presupuesto', 'consent_marketing', 'dias', 'horario', 'service_code',
  'source_page', 'case_id', 'cta_id', 'submission_id',
  'cf-turnstile-response', 'botcheck',
];

const MAX_LARGO = {
  nombre: 200,
  empresa: 200,
  email: 200,
  telefono: 60,
  mensaje: 5000,
  presupuesto: 200,
  dias: 200,
  horario: 100,
  source_page: 300,
  case_id: 160,
  cta_id: 100,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[a-z0-9]+(?:[\/_-][a-z0-9]+)*$/i;

function respuestaJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textoLimpio(valor, maxLargo) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, maxLargo);
}

function validarPathInterno(valor) {
  const path = textoLimpio(valor, MAX_LARGO.source_page);
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('\\')
  ) {
    return null;
  }

  try {
    const url = new URL(path, 'https://solazstudio.cl');
    if (url.origin !== 'https://solazstudio.cl' || url.pathname !== path) {
      return null;
    }
  } catch {
    return null;
  }

  return path;
}

function validarToken(valor, maxLargo) {
  const token = textoLimpio(valor, maxLargo);
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

function obtenerOrigenUrl(sourcePage, referer) {
  if (sourcePage) {
    return new URL(sourcePage, 'https://solazstudio.cl').toString();
  }

  try {
    const url = new URL(referer || '');
    if (!ORIGENES_PERMITIDOS.has(url.origin)) return null;
    return new URL(url.pathname, 'https://solazstudio.cl').toString();
  } catch {
    return null;
  }
}

async function verificarTurnstile(token, secretKey, ip) {
  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token || '');
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Validar Origin para impedir el uso directo desde otros sitios.
  const origin = request.headers.get('Origin') || '';
  if (origin && !ORIGENES_PERMITIDOS.has(origin)) {
    return respuestaJson({ ok: false, error: 'origen_no_permitido' }, 403);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return respuestaJson({ ok: false, error: 'formato_invalido' }, 400);
  }

  // 2. Honeypot: éxito falso, sin persistencia ni Queue.
  if (form.get('botcheck')) {
    return respuestaJson({ ok: true });
  }

  // 3. Lista blanca de campos; cualquier otro campo se ignora.
  const datos = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    datos[campo] = form.get(campo);
  }

  const diasSeleccionados = form
    .getAll('dias[]')
    .map((dia) => textoLimpio(dia, 40))
    .filter(Boolean);
  if (diasSeleccionados.length) {
    datos.dias = diasSeleccionados.join(', ');
  }

  const formType = datos.form_type === 'reunion' ? 'reunion' : 'mensaje';
  const nombre = textoLimpio(datos.nombre, MAX_LARGO.nombre);
  const email = textoLimpio(datos.email, MAX_LARGO.email);
  const telefono = textoLimpio(datos.telefono, MAX_LARGO.telefono);
  const empresa = textoLimpio(datos.empresa, MAX_LARGO.empresa);
  const serviceCode = textoLimpio(datos.service_code, 100);
  const submissionId = textoLimpio(datos.submission_id, 50);

  if (!nombre || !email || !serviceCode || !submissionId) {
    return respuestaJson({ ok: false, error: 'faltan_campos_obligatorios' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respuestaJson({ ok: false, error: 'email_invalido' }, 400);
  }

  if (!SERVICE_CODES.has(serviceCode)) {
    return respuestaJson({ ok: false, error: 'servicio_invalido' }, 400);
  }

  if (!UUID_PATTERN.test(submissionId)) {
    return respuestaJson({ ok: false, error: 'submission_id_invalido' }, 400);
  }

  const sourcePageRaw = textoLimpio(datos.source_page, MAX_LARGO.source_page);
  const sourcePage = sourcePageRaw ? validarPathInterno(sourcePageRaw) : null;
  if (sourcePageRaw && !sourcePage) {
    return respuestaJson({ ok: false, error: 'source_page_invalido' }, 400);
  }

  const caseIdRaw = textoLimpio(datos.case_id, MAX_LARGO.case_id);
  const caseId = caseIdRaw ? validarToken(caseIdRaw, MAX_LARGO.case_id) : null;
  if (caseIdRaw && !caseId) {
    return respuestaJson({ ok: false, error: 'case_id_invalido' }, 400);
  }

  const ctaIdRaw = textoLimpio(datos.cta_id, MAX_LARGO.cta_id);
  const ctaId = ctaIdRaw ? validarToken(ctaIdRaw, MAX_LARGO.cta_id) : null;
  if (ctaIdRaw && !ctaId) {
    return respuestaJson({ ok: false, error: 'cta_id_invalido' }, 400);
  }

  let mensaje = '';
  let presupuesto = null;
  let dias = null;
  let horario = null;

  if (formType === 'mensaje') {
    mensaje = textoLimpio(datos.mensaje, MAX_LARGO.mensaje);
    presupuesto = textoLimpio(datos.presupuesto, MAX_LARGO.presupuesto) || null;
    if (!mensaje) {
      return respuestaJson({ ok: false, error: 'faltan_campos_obligatorios' }, 400);
    }
  } else {
    dias = textoLimpio(datos.dias, MAX_LARGO.dias) || null;
    horario = textoLimpio(datos.horario, MAX_LARGO.horario) || null;
    if (!dias || !horario) {
      return respuestaJson({ ok: false, error: 'faltan_campos_obligatorios' }, 400);
    }
    mensaje = `Solicitud de reunión. Días: ${dias}. Horario: ${horario}.`;
  }

  // Los identificadores de contexto se validan ahora, pero service_code,
  // case_id y cta_id tendrán persistencia estructurada recién en F1.2.
  void caseId;
  void ctaId;

  // 4. Turnstile sigue siendo obligatorio y server-side.
  const ip = request.headers.get('CF-Connecting-IP');
  const turnstileOk = await verificarTurnstile(
    datos['cf-turnstile-response'],
    env.TURNSTILE_SECRET_KEY,
    ip
  );
  if (!turnstileOk) {
    return respuestaJson({ ok: false, error: 'verificacion_fallida' }, 400);
  }

  const consentMarketing = datos.consent_marketing === 'si' ? 1 : 0;
  const origenUrl = obtenerOrigenUrl(sourcePage, request.headers.get('Referer'));

  // 5. Inserción atómica e idempotente usando la columna id existente.
  let inserted;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO contacts
        (id, form_type, nombre, empresa, email, telefono, mensaje, presupuesto,
         consent_marketing, dias, horario, origen_url, sync_status)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending'
       WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE id = ?)`
    ).bind(
      submissionId,
      formType,
      nombre,
      empresa || null,
      email,
      telefono || null,
      mensaje,
      presupuesto,
      consentMarketing,
      dias,
      horario,
      origenUrl,
      submissionId
    ).run();
    inserted = Number(result?.meta?.changes ?? result?.changes ?? 0) > 0;
  } catch {
    return respuestaJson({ ok: false, error: 'error_guardando' }, 500);
  }

  if (!inserted) {
    return respuestaJson({ ok: true, id: submissionId, deduplicated: true });
  }

  // 6. Queue es best-effort después de persistir en D1.
  try {
    await env.CONTACT_QUEUE.send({ id: submissionId });
  } catch {
    // D1 ya es la fuente de verdad; la respuesta continúa siendo exitosa.
  }

  return respuestaJson({ ok: true, id: submissionId, deduplicated: false });
}
