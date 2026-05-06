/**
 * GameRegistry
 * Loads and queries the central game manifest at games/registry.json.
 */
class GameRegistry {
  constructor() {
    this.games = [];
    this._loaded = false;
    this._promise = null;
  }

  /**
   * Fetch and cache the registry. Safe to call multiple times.
   * @returns {Promise<Array>} list of all game entries
   */
  load() {
    if (this._loaded) return Promise.resolve(this.games);
    if (this._promise) return this._promise;

    this._promise = fetch('games/registry.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        this.games = Array.isArray(data.games) ? data.games : [];
        this._loaded = true;
        return this.games;
      })
      .catch(err => {
        console.error('[GameRegistry] Failed to load registry:', err);
        this._promise = null; // allow retry
        return [];
      });

    return this._promise;
  }

  /**
   * Return all games compatible with a given duration.
   * @param {number} seconds
   * @returns {Array}
   */
  getGamesForDuration(seconds) {
    return this.games.filter(
      g => seconds >= g.minTime && seconds <= g.maxTime
    );
  }

  /**
   * Pick a random game compatible with the given duration.
   * @param {number} seconds
   * @returns {Object|null} game entry or null if none available
   */
  pickRandom(seconds) {
    const eligible = this.getGamesForDuration(seconds);
    if (!eligible.length) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }
}
