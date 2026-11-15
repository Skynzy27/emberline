// The one state object. Every module reads and writes this same object; no module
// keeps its own copy of round, money or the bomb, so the HUD, the bots and the
// round flow can never disagree about what is happening.
export const ROUND_TIME = 100; // seconds of live play per round
export const BUY_TIME = 8; // seconds of buy phase before the round goes live
export const BOMB_TIME = 35; // seconds from plant to detonation
export const PLANT_TIME = 3; // seconds holding E at a site to plant
export const DEFUSE_TIME = 5; // seconds a bot must channel to defuse
export const WIN_ROUNDS = 5; // first to this many round wins takes the match
export const MAX_ROUNDS = 9;
export const START_MONEY = 800;
export const KILL_REWARD = 300;
export const WIN_REWARD = 325;
export const LOSS_REWARD = 140;
export const PLANT_REWARD = 300;

export function createState() {
  return {
    phase: 'menu', // menu | buy | live | roundEnd | matchEnd
    round: 1,
    wins: 0, // Ember (player) rounds won
    losses: 0, // Warden rounds won
    money: START_MONEY,
    timer: BUY_TIME, // counts down in buy and live
    time: 0, // total seconds since match start
    bomb: {
      state: 'carried', // carried | planted | defused | exploded
      site: null, // 'A' | 'B'
      timer: 0, // detonation countdown once planted
      plantProgress: 0,
      defuseProgress: 0,
      defuser: null,
      pos: null, // THREE.Vector3 once planted
    },
    player: {
      hp: 100,
      alive: true,
      hasBomb: true,
      frags: 0,
      flashes: 0,
      kills: 0,
      deaths: 0,
    },
    botsAlive: 4,
    kills: 0, // player kills this match
    feed: [], // {text, good} kill-feed lines, newest first
    message: '', // centre-screen banner text
    messageUntil: 0,
    noise: [], // {x, z, radius, t} gunshot sounds bots react to
    roundResult: null, // {won, reason} for the end overlay
    matchWinner: null, // 'Ember' | 'Wardens'
    seed: 1,
  };
}
