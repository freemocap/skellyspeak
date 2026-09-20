"""Offline, seeded projections of unique texts; full-space density clustering.
[@umapParameters] [@umapClustering] [@sklearnTrustworthiness]
"""
import hashlib
import importlib.metadata
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE, trustworthiness
from sklearn.metrics import pairwise_distances
from sklearn.preprocessing import normalize
from umap import UMAP

directory = Path(sys.argv[1])
plan = json.loads((directory / "embedding-plan.json").read_text())
# Only project texts actually present in the frozen corpus, not spare cache entries.
hashes = set()
for run in plan["directories"]:
    for line in (Path(run) / "results.jsonl").read_text().splitlines():
        row = json.loads(line)
        if row["status"] == "complete":
            hashes.add(hashlib.sha256(row["content"].encode()).hexdigest())
cache = {r["hash"]: r for r in map(json.loads, (directory / "embeddings.jsonl").read_text().splitlines())}
keys = sorted(hashes)
x = normalize(np.array([cache[key]["vector"] for key in keys], dtype=np.float64))
distances = np.maximum(0, pairwise_distances(x, metric="cosine"))
np.fill_diagonal(distances, 0)
neighbors = np.argsort(distances, axis=1)[:, 1:11]
projections = []
for dimensions in [2, 3]:
    settings = [("PCA", {}), ("t-SNE", {"perplexity": 15}),
                ("t-SNE", {"perplexity": 40}),
                ("UMAP", {"n_neighbors": 15, "min_dist": .1}),
                ("UMAP", {"n_neighbors": 40, "min_dist": .3})]
    for method, parameters in settings:
        for seed in ([42, 43] if method == "UMAP" and parameters["n_neighbors"] == 15 else [42]):
            if method == "PCA":
                estimator = PCA(n_components=dimensions, svd_solver="full")
            elif method == "t-SNE":
                estimator = TSNE(n_components=dimensions, metric="cosine", perplexity=parameters["perplexity"],
                                 random_state=seed, init="pca", learning_rate="auto", max_iter=1000, n_jobs=1)
            else:
                estimator = UMAP(n_components=dimensions, metric="cosine", random_state=seed,
                                 n_jobs=1, **parameters)
            y = estimator.fit_transform(x)
            if not np.isfinite(y).all():
                raise ValueError("Non-finite projection")
            projected_neighbors = np.argsort(pairwise_distances(y), axis=1)[:, 1:11]
            recall = np.mean([len(set(a) & set(b)) / 10 for a, b in zip(neighbors, projected_neighbors)])
            label = f"{method} {dimensions}D · " + " · ".join(f"{k}={v}" for k, v in parameters.items())
            label += f" · seed {seed}" if method != "PCA" else "unique texts"
            projections.append(dict(label=label, method=method, dimensions=dimensions, parameters=parameters,
                                    seed=seed if method != "PCA" else None, coordinates=y.tolist(),
                                    trustworthiness10=float(trustworthiness(x, y, n_neighbors=10, metric="cosine")),
                                    neighborRecall10=float(recall)))
            print(label, flush=True)
# Density labels are derived from original cosine distances, never from 2D islands.
cluster = HDBSCAN(min_cluster_size=10, min_samples=5, metric="precomputed").fit(distances)
output = dict(version=1, corpusSignature=plan["signature"], hashes=keys, projections=projections,
              clusters=cluster.labels_.tolist(), probabilities=cluster.probabilities_.tolist(),
              clusterSettings=dict(method="HDBSCAN", metric="original-space cosine", min_cluster_size=10, min_samples=5),
              versions={p: importlib.metadata.version(p) for p in ["numpy", "scipy", "scikit-learn", "umap-learn", "numba"]})
(directory / "projections.json").write_text(json.dumps(output, allow_nan=False))
