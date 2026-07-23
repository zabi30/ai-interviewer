import fetch from 'node-fetch';

const HF_MODEL = 'facebook/detr-resnet-50';
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_TIMEOUT_MS = 8000; // give up if HF takes too long

/**
 * Analyze a base64 JPEG frame using HF object detection.
 * Returns null on any failure — never throws, never blocks the caller.
 */
export async function analyzeFrame(base64DataUrl) {
  try {
    const hfKey = process.env.HUGGING_FACE_KEY;
    if (!hfKey) {
      console.warn('[VisionProctor] HUGGING_FACE_KEY not set. Skipping frame.');
      return null;
    }

    // Strip data URL prefix (data:image/jpeg;base64,...)
    const base64 = base64DataUrl.includes(',')
      ? base64DataUrl.split(',')[1]
      : base64DataUrl;

    const imageBuffer = Buffer.from(base64, 'base64');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      const text = await response.text();
      // Model may be loading (503) — just skip silently
      if (response.status !== 503) {
        console.warn(`[VisionProctor] HF API error ${response.status}: ${text.slice(0, 120)}`);
      }
      return null;
    }

    const detections = await response.json();
    if (!Array.isArray(detections)) return null;

    // Filter by confidence threshold
    const SCORE_THRESHOLD = 0.72;
    const labels = detections
      .filter(d => d.score >= SCORE_THRESHOLD)
      .map(d => (d.label || '').toLowerCase());

    const personCount = labels.filter(l => l === 'person').length;
    const phoneDetected = labels.some(l => l === 'cell phone');
    const laptopDetected = labels.some(l => l === 'laptop');

    const flags = [];
    if (personCount === 0) flags.push('no_person');
    if (personCount > 1) flags.push('multiple_people');
    if (phoneDetected) flags.push('phone_detected');
    if (laptopDetected) flags.push('secondary_device');

    return {
      timestamp: Date.now(),
      personCount,
      phoneDetected,
      laptopDetected,
      flags,
      clean: flags.length === 0,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[VisionProctor] HF API timed out. Skipping frame.');
    } else {
      console.error('[VisionProctor] Frame analysis error:', err.message);
    }
    return null;
  }
}

/**
 * Aggregate all frame results into a human-readable proctor summary.
 * Called at interview end to feed into the AI scoring report.
 */
export function aggregateProctorFrames(frames) {
  if (!frames || frames.length === 0) {
    return {
      summary: 'No visual proctoring data available (frames not captured or HF unavailable).',
      severity: 'unknown',
      details: {},
    };
  }

  const valid = frames.filter(f => f !== null && f !== undefined);
  if (valid.length === 0) {
    return {
      summary: 'Visual proctoring: all frame analyses failed or timed out.',
      severity: 'unknown',
      details: {},
    };
  }

  const total = valid.length;
  const noPerson   = valid.filter(f => f.flags.includes('no_person')).length;
  const multiPerson= valid.filter(f => f.flags.includes('multiple_people')).length;
  const phone      = valid.filter(f => f.flags.includes('phone_detected')).length;
  const device     = valid.filter(f => f.flags.includes('secondary_device')).length;
  const clean      = valid.filter(f => f.clean).length;

  const details = { totalFrames: total, noPerson, multiPerson, phone, device, clean };

  const issues = [];
  if (phone > 0)       issues.push(`mobile phone visible in ${phone}/${total} frames`);
  if (multiPerson > 0) issues.push(`multiple people detected in ${multiPerson}/${total} frames`);
  if (noPerson > 2)    issues.push(`candidate absent or looking away in ${noPerson}/${total} frames`);
  if (device > 0)      issues.push(`secondary device (laptop/extra screen) detected in ${device}/${total} frames`);

  let severity = 'clean';
  if (phone > 0 || multiPerson > 1)              severity = 'high';
  else if (noPerson > total * 0.3 || multiPerson > 0) severity = 'medium';
  else if (issues.length > 0)                    severity = 'low';

  const summary = issues.length === 0
    ? `Visual proctoring CLEAN: ${clean}/${total} analyzed frames showed no violations.`
    : `Visual proctoring FLAGS DETECTED: ${issues.join('; ')}.`;

  return { summary, severity, details };
}
