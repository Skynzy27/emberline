// The DOM HUD: health, ammo, timer, score, money, kill feed, bomb status, the
// buy menu and the overlay panels. It never touches the simulation; main.js
// pushes numbers in and reads the play callback out.
import { WEAPONS, GRENADES } from './weapons.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const timerValue = $('timer-value');
  const scoreValue = $('score-value');
  const moneyValue = $('money-value');
  const aliveEmber = $('alive-ember');
  const aliveWarden = $('alive-warden');
  const feedEl = $('feed');
  const bombText = $('bomb-text');
  const messageEl = $('message');
  const plantFill = $('plant-fill');
  const plantBar = $('plant-bar');
  const vignette = $('vignette');
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const buyEl = $('buy');
  const buyMoney = $('buy-money');
  const buyItems = $('buy-items');
  const grenadeFrag = $('grenade-frag');
  const grenadeFlash = $('grenade-flash');
  let last = {};
  let hitTimer = 0;
  let msgTimer = 0;

  const COPY = {
    start: { title: 'EMBERLINE', copy: 'A dusk yard, four Wardens, one charge. Plant it at the Furnace or the Silo — or drop them all. Click to play.', action: 'Click to play' },
    paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  };

  // Buy menu rows, built once from the weapon defs.
  const rows = [];
  WEAPONS.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'buy-row';
    row.innerHTML = `<span class="buy-key">${i + 1}</span><span class="buy-name"></span><span class="buy-price"></span>`;
    row.querySelector('.buy-name').textContent = w.name;
    buyItems.appendChild(row);
    rows.push({ row, price: row.querySelector('.buy-price'), def: w, index: i, kind: 'weapon' });
  });
  GRENADES.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'buy-row';
    row.innerHTML = `<span class="buy-key">${4 + i}</span><span class="buy-name"></span><span class="buy-price"></span>`;
    row.querySelector('.buy-name').textContent = g.name;
    buyItems.appendChild(row);
    rows.push({ row, price: row.querySelector('.buy-price'), def: g, index: i, kind: g.id });
  });

  function setText(el, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    el.textContent = value;
  }

  return {
    setHealth(hp) {
      healthFill.style.width = `${Math.max(0, hp)}%`;
      healthFill.classList.toggle('low', hp <= 30);
      setText(healthNum, 'hp', String(Math.ceil(hp)));
    },
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'res', `/ ${reserve}`);
      setText(weaponName, 'wname', name);
      $('ammo').classList.toggle('empty', mag === 0);
    },
    setGrenades(frag, flash) {
      setText(grenadeFrag, 'frag', `Frag ${frag}`);
      setText(grenadeFlash, 'flash', `Flash ${flash}`);
    },
    setTimer(sec) {
      const m = Math.max(0, Math.floor(sec / 60));
      const s = Math.max(0, Math.floor(sec % 60));
      setText(timerValue, 'timer', `${m}:${s < 10 ? '0' : ''}${s}`);
      timerValue.classList.toggle('urgent', sec <= 10);
    },
    setScore(wins, losses, round) {
      setText(scoreValue, 'score', `${wins} — ${losses}`);
      setText($('round-label'), 'round', `Round ${round}`);
    },
    setMoney(m) {
      setText(moneyValue, 'money', `$${m}`);
    },
    setAlive(emberAlive, wardenAlive) {
      setText(aliveEmber, 'ae', `Ember ${emberAlive}`);
      setText(aliveWarden, 'aw', `Wardens ${wardenAlive}`);
    },
    setBomb(text, urgent) {
      setText(bombText, 'bomb', text);
      bombText.classList.toggle('urgent', !!urgent);
    },
    setPlant(progress) {
      if (progress > 0) {
        plantBar.hidden = false;
        plantFill.style.width = `${Math.min(100, progress * 100)}%`;
      } else {
        plantBar.hidden = true;
      }
    },
    setCrosshairSpread(px) {
      crosshair.style.setProperty('--spread', `${px.toFixed(1)}px`);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    hurtFlash() {
      vignette.classList.add('on');
      setTimeout(() => vignette.classList.remove('on'), 180);
    },
    showMessage(text, seconds = 3) {
      messageEl.textContent = text;
      messageEl.classList.add('on');
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => messageEl.classList.remove('on'), seconds * 1000);
    },
    pushFeed(lines) {
      feedEl.innerHTML = '';
      for (const line of lines.slice(0, 4)) {
        const div = document.createElement('div');
        div.className = line.good ? 'feed-good' : 'feed-bad';
        div.textContent = line.text;
        feedEl.appendChild(div);
      }
    },
    showOverlay(mode, score) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    showRoundEnd(state, won, reason) {
      title.textContent = won ? 'Round won' : 'Round lost';
      copy.textContent = `${reason}. Ember ${state.wins} — ${state.losses} Wardens. Next round in a moment.`;
      play.textContent = 'Continue';
      overlay.hidden = false;
    },
    showMatchEnd(state) {
      const won = state.matchWinner === 'Ember';
      title.textContent = won ? 'Match won — the yard is yours' : 'Match lost — the Wardens hold the yard';
      copy.textContent = `Final score Ember ${state.wins} — ${state.losses} Wardens. ${state.kills} eliminations.`;
      play.textContent = 'Play again';
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    setBuyVisible(visible) {
      buyEl.hidden = !visible;
    },
    refreshBuy(money, owned, grenades) {
      setText(buyMoney, 'buymoney', `$${money}`);
      for (const r of rows) {
        if (r.kind === 'weapon') {
          r.price.textContent = owned[r.index] ? 'OWNED' : `$${r.def.price}`;
          r.row.classList.toggle('owned', owned[r.index]);
          r.row.classList.toggle('cant', !owned[r.index] && money < r.def.price);
        } else {
          r.price.textContent = `$${r.def.price} ×${grenades[r.kind]}`;
          r.row.classList.toggle('cant', money < r.def.price);
        }
      }
    },
  };
}
