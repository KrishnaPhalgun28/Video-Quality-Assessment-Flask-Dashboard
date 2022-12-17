import os
import yaml
import pickle as pkl

import numpy as np
import torch

from .dover.models import DOVER
from .dover.datasets import UnifiedFrameSampler
from .dover.datasets import spatial_temporal_view_decomposition

import warnings

warnings.filterwarnings("ignore", category=UserWarning)

script_path = os.path.dirname(__file__)
opt_path = os.path.join(script_path, "options.yml")

mean, std = torch.FloatTensor([123.675, 116.28, 103.53]), torch.FloatTensor([58.395, 57.12, 57.375])

def gaussian_rescale(pr):
    pr = (pr - np.mean(pr)) / np.std(pr)
    return pr

def uniform_rescale(pr):
    return np.arange(len(pr))[np.argsort(pr).argsort()] / len(pr)

def rescale_results(results: list, vname="undefined"):
    dbs = {
        "livevqc": "LIVE_VQC",
        "kv1k": "KoNViD-1k",
        "ltest": "LSVQ_Test",
        "l1080p": "LSVQ_1080P",
    }
    tqe_nscore, aqe_nscore = 0, 0
    for abbr, full_name in dbs.items():
        with open(os.path.join(script_path, "dover_predictions", f"val-{abbr}.pkl"), "rb") as f:
            pr_labels = pkl.load(f)
        aqe_score_set = pr_labels["resize"]
        tqe_score_set = pr_labels["fragments"]
        tqe_score_set_p = np.concatenate((np.array([results[0]]), tqe_score_set), 0)
        aqe_score_set_p = np.concatenate((np.array([results[1]]), aqe_score_set), 0)
        tqe_uscore = uniform_rescale(tqe_score_set_p)[0]
        tqe_nscore += gaussian_rescale(tqe_score_set_p)[0]
        # print(f"-- the technical quality of video [{vname}] is better than {int(tqe_uscore*100)}% of videos, with normalized score {tqe_nscore:.2f}.")
        aqe_uscore = uniform_rescale(aqe_score_set_p)[0]
        aqe_nscore += gaussian_rescale(aqe_score_set_p)[0]
        # print(f"-- the aesthetic quality of video [{vname}] is better than {int(aqe_uscore*100)}% of videos, with normalized score {aqe_nscore:.2f}.")
    return tqe_nscore / len(dbs), aqe_nscore / len(dbs)

def eval(video_path):
    with open(opt_path, "r") as f:
        opt = yaml.safe_load(f)
    evaluator = DOVER(**opt["model"]["args"]).to("cpu")
    test_load_path = os.path.join(script_path, "pretrained_weights", "DOVER.pth")
    evaluator.load_state_dict(torch.load(test_load_path, map_location="cpu"))
    dopt = opt["data"]["val-l1080p"]["args"]
    temporal_samplers = {}
    for stype, sopt in dopt["sample_types"].items():
        if "t_frag" not in sopt:
            temporal_samplers[stype] = UnifiedFrameSampler(
                sopt["clip_len"], sopt["num_clips"],
                sopt["frame_interval"],
            )
        else:
            temporal_samplers[stype] = UnifiedFrameSampler(
                sopt["clip_len"] // sopt["t_frag"],
                sopt["t_frag"],
                sopt["frame_interval"],
                sopt["num_clips"],
            )
    views, _ = spatial_temporal_view_decomposition(
        video_path, dopt["sample_types"],
        temporal_samplers,
    )
    for k, v in views.items():
        num_clips = dopt["sample_types"][k].get("num_clips", 1)
        views[k] = (
            ((v.permute(1, 2, 3, 0) - mean) / std)
            .permute(3, 0, 1, 2)
            .reshape(v.shape[0], num_clips, -1, *v.shape[2:])
            .transpose(0, 1)
            .to("cpu")
        )
    results = [r.mean().item() for r in evaluator(views)]
    return rescale_results(results, vname=video_path)

if __name__ == "_main_":
    eval("../demos/10053703034.mp4")