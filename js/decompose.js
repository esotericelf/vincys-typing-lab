import { CANGJIE_RADICALS } from './cangjieData.js';

/**
 * Heuristic structural composition label for teaching 拆碼.
 */
export function describeStructure(charObj) {
  const code = (charObj?.cangjieCode || '').toUpperCase();
  const roots = [...code].map((k) => CANGJIE_RADICALS[k] || k);
  const n = roots.length;

  if (n === 0) return '—';
  if (n === 1) return `整體結構：「${roots[0]}」`;
  if (n === 2) return `左右結構：左「${roots[0]}」+ 右「${roots[1]}」`;
  if (n === 3) {
    return `複合結構：上／外「${roots[0]}」+ 中「${roots[1]}」+ 下／內「${roots[2]}」`;
  }
  const parts = roots.map((r, i) => `第${i + 1}碼「${r}」`).join(' + ');
  return `多根組合：${parts}`;
}

export function buildStepData(charObj) {
  const code = (charObj?.cangjieCode || '').toUpperCase();
  return [...code].map((letter, i) => ({
    index: i,
    letter,
    radical: CANGJIE_RADICALS[letter] || letter,
    label: `第 ${i + 1} 碼`,
  }));
}

/**
 * Run sequential 拆碼 UI + keyboard animation.
 * @returns {Promise<void>}
 */
export function playDecomposeAnimation({
  charObj,
  keyboard,
  stepsContainer,
  structureEl,
  onStep,
  stepDelay = 400,
  signal,
}) {
  const steps = buildStepData(charObj);
  const structure = describeStructure(charObj);

  if (structureEl) structureEl.textContent = structure;

  if (stepsContainer) {
    stepsContainer.innerHTML = '';
    steps.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'decomp-step';
      el.dataset.index = String(s.index);
      el.innerHTML = `
        <span class="decomp-step-label">${s.label}</span>
        <span class="decomp-step-radical">「${s.radical}」</span>
        <span class="decomp-step-key">Key ${s.letter}</span>
      `;
      stepsContainer.appendChild(el);
    });
  }

  keyboard?.clearHints?.();

  return new Promise((resolve) => {
    let i = 0;
    const timers = [];

    const finish = () => {
      timers.forEach(clearTimeout);
      // leave all keys highlighted as hint
      if (keyboard && steps.length) {
        keyboard.setHints(steps.map((s) => s.letter));
      }
      if (stepsContainer) {
        stepsContainer.querySelectorAll('.decomp-step').forEach((el) => {
          el.classList.add('done');
          el.classList.remove('active');
        });
      }
      resolve();
    };

    const aborted = () => signal?.aborted;

    const tick = () => {
      if (aborted()) {
        finish();
        return;
      }
      if (i >= steps.length) {
        finish();
        return;
      }

      const step = steps[i];
      if (stepsContainer) {
        stepsContainer.querySelectorAll('.decomp-step').forEach((el) => {
          const idx = Number(el.dataset.index);
          el.classList.toggle('active', idx === i);
          el.classList.toggle('done', idx < i);
        });
      }

      keyboard?.pulseKey?.(step.letter, stepDelay + 80);
      if (typeof onStep === 'function') onStep(step, i);

      i += 1;
      timers.push(setTimeout(tick, stepDelay));
    };

    timers.push(setTimeout(tick, 120));
  });
}
