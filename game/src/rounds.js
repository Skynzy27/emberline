// Round flow: buy phase -> live -> round end -> next round or match end.
// Money, the charge (plant/defuse), and win/loss reasons live here; the sim in
// main.js only calls step() and the buy/plant actions.
import {
  ROUND_TIME, BUY_TIME, BOMB_TIME, PLANT_TIME, DEFUSE_TIME,
  WIN_ROUNDS, MAX_ROUNDS, START_MONEY, KILL_REWARD, WIN_REWARD, LOSS_REWARD, PLANT_REWARD,
} from './state.js';
import { WEAPONS, GRENADES } from './weapons.js';

export function createRounds(deps) {
  const { state, player, weapons, bots, map, audio, hud } = deps;

  function startMatch() {
    state.phase = 'buy';
    state.round = 1;
    state.wins = 0;
    state.losses = 0;
    state.money = START_MONEY;
    state.kills = 0;
    state.feed = [];
    state.matchWinner = null;
    startRound();
  }

  function startRound() {
    state.phase = 'buy';
    state.timer = BUY_TIME;
    state.bomb = { state: 'carried', site: null, timer: 0, plantProgress: 0, defuseProgress: 0, defuser: null, pos: null };
    state.player.hp = 100;
    state.player.alive = true;
    state.player.hasBomb = true;
    state.player.frags = 0;
    state.player.flashes = 0;
    state.noise = [];
    player.reset(map.spawns.ember[1], 0);
    bots.reset(state.round);
    weapons.refillAmmo();
    map.bombMesh.visible = false;
    hud.setBuyVisible(true);
    hud.showMessage(`Round ${state.round} — buy phase`, 3);
    hud.refreshBuy(state.money, weapons.owned, weapons.state.grenades);
  }

  function goLive() {
    state.phase = 'live';
    state.timer = ROUND_TIME;
    hud.setBuyVisible(false);
    hud.showMessage(state.round === 1 ? 'Plant the charge at Furnace or Silo' : `Round ${state.round} — go`, 3);
  }

  function endRound(won, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return;
    if (won) {
      state.wins += 1;
      state.money += WIN_REWARD;
    } else {
      state.losses += 1;
      state.money += LOSS_REWARD;
    }
    state.roundResult = { won, reason };
    if (state.wins >= WIN_ROUNDS || state.losses >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.phase = 'matchEnd';
      state.matchWinner = state.wins > state.losses ? 'Ember' : 'Wardens';
      if (state.wins > state.losses) audio.win();
      else audio.lose();
      hud.showMatchEnd(state);
    } else {
      state.phase = 'roundEnd';
      state.timer = 4;
      if (won) audio.win();
      else audio.lose();
      hud.showRoundEnd(state, won, reason);
    }
  }

  function nextRound() {
    state.round += 1;
    startRound();
  }

  // Plant: hold E near a site. Returns true while planting is in progress.
  function plantStep(dt, holding) {
    if (state.phase !== 'live' || !state.player.alive || state.bomb.state !== 'carried') return false;
    let near = null;
    for (const site of Object.values(map.sites)) {
      const p = player.state.position;
      if (Math.hypot(p.x - site.pos.x, p.z - site.pos.z) < 2.6) {
        near = site;
        break;
      }
    }
    if (!near || !holding) {
      state.bomb.plantProgress = 0;
      return false;
    }
    state.bomb.plantProgress += dt;
    if (state.bomb.plantProgress >= PLANT_TIME) {
      state.bomb.state = 'planted';
      state.bomb.site = near.id;
      state.bomb.timer = BOMB_TIME;
      state.bomb.pos = near.pos.clone();
      state.bomb.pos.y = 0.16;
      state.player.hasBomb = false;
      state.money += PLANT_REWARD;
      map.bombMesh.position.copy(state.bomb.pos);
      map.bombMesh.visible = true;
      map.bombLight.position.copy(state.bomb.pos).y = 1;
      state.feed.unshift({ text: `Charge planted at ${near.name}  +$${PLANT_REWARD}`, good: true });
      audio.plantBeep();
      hud.showMessage(`Charge planted at ${near.name} — defend it`, 3);
    }
    return true;
  }

  function buy(index, kind) {
    if (state.phase !== 'buy') return;
    if (kind === 'weapon') {
      const before = state.money;
      state.money = weapons.buy(index, state.money);
      if (state.money < before) {
        weapons.select(index);
        audio.buy();
        hud.refreshBuy(state.money, weapons.owned, weapons.state.grenades);
      } else {
        audio.denied();
      }
    } else {
      const g = GRENADES.find((x) => x.id === kind);
      if (state.money >= g.price) {
        state.money -= g.price;
        weapons.state.grenades[kind] += 1;
        audio.buy();
        hud.refreshBuy(state.money, weapons.owned, weapons.state.grenades);
      } else {
        audio.denied();
      }
    }
  }

  function step(dt) {
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) goLive();
      return;
    }
    if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) nextRound();
      return;
    }
    if (state.phase !== 'live') return;
    state.timer -= dt;
    // Bomb countdown.
    if (state.bomb.state === 'planted') {
      state.bomb.timer -= dt;
      if (state.bomb.timer < 10 && Math.floor(state.bomb.timer * 2) !== Math.floor((state.bomb.timer + dt) * 2)) {
        audio.plantBeep();
      }
      if (state.bomb.defuseProgress >= DEFUSE_TIME) {
        state.bomb.state = 'defused';
        endRound(false, 'Wardens defused the charge');
        return;
      }
      if (state.bomb.timer <= 0) {
        state.bomb.state = 'exploded';
        endRound(true, `Charge detonated at ${map.sites[state.bomb.site].name}`);
        return;
      }
    }
    // Win/loss checks.
    if (!state.player.alive) {
      if (state.bomb.state === 'planted') {
        // The charge still ticks while the bots try to defuse it.
        return;
      }
      endRound(false, 'You were dropped');
      return;
    }
    if (state.botsAlive === 0) {
      endRound(true, state.bomb.state === 'planted' ? 'All Wardens down — charge holds' : 'All Wardens eliminated');
      return;
    }
    if (state.timer <= 0) {
      endRound(false, 'Time expired — Wardens hold the yard');
    }
  }

  return { startMatch, startRound, goLive, endRound, nextRound, plantStep, buy, step, WEAPONS, KILL_REWARD };
}
