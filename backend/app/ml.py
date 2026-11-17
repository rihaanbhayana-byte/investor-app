"""Stock personality map: group stocks with k-means clustering.

Each stock is described by three numbers from its real price history since 2016:
  - average yearly return
  - volatility (how much it swings)
  - biggest drop from a peak
The numbers are standardised (so each one counts equally), then k-means finds
groups of stocks that behave alike. No labels are given to the algorithm:
it discovers the groups by itself (unsupervised learning).
"""
import numpy as np


def kmeans(points, k, restarts=20, iterations=100, seed=7):
    """Plain k-means with k-means++ starting points. Returns (labels, centres, inertia)."""
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(restarts):
        # k-means++: spread the starting centres out
        centres = [points[rng.integers(len(points))]]
        for _ in range(1, k):
            distances = np.min([((points - c) ** 2).sum(axis=1) for c in centres], axis=0)
            centres.append(points[rng.choice(len(points), p=distances / distances.sum())])
        centres = np.array(centres)

        for _ in range(iterations):
            labels = np.argmin(((points[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2), axis=1)
            new_centres = np.array([
                points[labels == j].mean(axis=0) if np.any(labels == j) else centres[j] for j in range(k)
            ])
            if np.allclose(new_centres, centres):
                break
            centres = new_centres

        inertia = float(((points - centres[labels]) ** 2).sum())
        if best is None or inertia < best[2]:
            best = (labels, centres, inertia)
    return best


PERSONALITIES = {
    "steady": ("Calmer rides", "The smallest swings in our list. Calm is relative: even these can drop a lot in a crash."),
    "rocket": ("Rockets", "The biggest growth since 2016, with big swings along the way."),
    "grower": ("Solid growers", "Good growth with moderate ups and downs."),
    "bumpy": ("Bumpy rides", "Lots of ups and downs, but less reward for the stress."),
    "middle": ("Middle of the road", "Average growth with average ups and downs."),
}


def name_clusters(centres_raw):
    """Give each cluster a beginner-friendly name from its average return and volatility."""
    k = len(centres_raw)
    names = {}
    remaining = list(range(k))
    steady = min(remaining, key=lambda j: centres_raw[j][1])  # lowest volatility
    names[steady] = "steady"
    remaining.remove(steady)
    rocket = max(remaining, key=lambda j: centres_raw[j][0])  # highest return
    names[rocket] = "rocket"
    remaining.remove(rocket)
    if remaining:
        # of what's left, return earned per unit of volatility decides grower vs bumpy;
        # with 5 groups, the one in between is "middle of the road"
        ranked = sorted(remaining, key=lambda j: centres_raw[j][0] / max(centres_raw[j][1], 1e-6), reverse=True)
        names[ranked[0]] = "grower"
        if len(ranked) > 1:
            names[ranked[-1]] = "bumpy"
        for j in ranked[1:-1]:
            names[j] = "middle"
    return names


def stock_map(stats_by_symbol, k=4):
    """stats_by_symbol = {symbol: {"annual_return":..., "annual_volatility":..., "max_drawdown":...}}"""
    symbols = sorted(stats_by_symbol)
    raw = np.array([
        [stats_by_symbol[s]["annual_return"], stats_by_symbol[s]["annual_volatility"], -stats_by_symbol[s]["max_drawdown"]]
        for s in symbols
    ])
    scaled = (raw - raw.mean(axis=0)) / raw.std(axis=0)
    labels, centres, inertia = kmeans(scaled, k)
    centres_raw = np.array([raw[labels == j].mean(axis=0) for j in range(k)])
    names = name_clusters(centres_raw)

    clusters = []
    for j in range(k):
        key = names[j]
        title, description = PERSONALITIES[key]
        members = [symbols[i] for i in range(len(symbols)) if labels[i] == j]
        clusters.append({
            "key": key,
            "name": title,
            "description": description,
            "count": len(members),
            "avg_return": round(float(centres_raw[j][0]), 4),
            "avg_volatility": round(float(centres_raw[j][1]), 4),
            "avg_drop": round(float(-centres_raw[j][2]), 4),
            "members": members,
        })
    order = {"steady": 0, "grower": 1, "middle": 2, "rocket": 3, "bumpy": 4}
    clusters.sort(key=lambda c: order[c["key"]])
    cluster_of = {symbol: names[labels[i]] for i, symbol in enumerate(symbols)}

    # How clearly does each stock belong? (silhouette score, a standard ML measure)
    from .confidence import silhouettes
    scores, runner_up = silhouettes(scaled, labels)
    fit_of = {}
    for i, symbol in enumerate(symbols):
        sc = float(scores[i])
        fit = "clear" if sc >= 0.5 else "good" if sc >= 0.25 else "borderline"
        fit_of[symbol] = {
            "fit": fit,
            "fit_score": round(sc, 3),
            "fit_label": {"clear": "Clearly", "good": "Fits", "borderline": "Between groups:"}[fit],
            "runner_up": PERSONALITIES[names[runner_up[i]]][0],
        }
    overall = round(float(np.mean(scores)), 3)
    return clusters, cluster_of, round(inertia, 3), fit_of, overall
