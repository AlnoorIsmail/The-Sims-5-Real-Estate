#!/usr/bin/env bash
#SBATCH --job-name=proptech-ml-gpu
#SBATCH --output=proptech-ml-%j.out
#SBATCH --error=proptech-ml-%j.err
#SBATCH --time=02:00:00
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --gres=gpu:1

set -euo pipefail

cd /home/alnoor.ismail/projects/The-Sims-5-Real-Estate

echo "Project: $(pwd)"
echo "Python: $(python3 --version)"
echo "CUDA_VISIBLE_DEVICES: ${CUDA_VISIBLE_DEVICES:-unset}"
echo "Started: $(date -Is)"

test -d ml_pipeline
test -f requirements.txt
test -d data

if [[ -d .proptech_deps/pandas && -d .proptech_deps/catboost && -d .proptech_deps/xgboost ]]; then
  echo "Using existing local dependency target: .proptech_deps"
else
  python3 -m pip install -r requirements.txt --target .proptech_deps
fi

export PYTHONPATH="$PWD/.proptech_deps${PYTHONPATH:+:$PYTHONPATH}"
export PROPTECH_USE_GPU=1
export OMP_NUM_THREADS="${SLURM_CPUS_PER_TASK:-4}"
export OPENBLAS_NUM_THREADS="${SLURM_CPUS_PER_TASK:-4}"
export MKL_NUM_THREADS="${SLURM_CPUS_PER_TASK:-4}"

python3 -u ml_pipeline/train_models.py
python3 -u ml_pipeline/predict_and_score.py

echo "Artifact check:"
for path in \
  models/price_per_sqm_xgb_regressor.joblib \
  models/price_per_sqm_catboost_regressor.joblib \
  models/estimated_value_aed_xgb_regressor.joblib \
  models/development_potential_score_xgb_regressor.joblib \
  models/development_potential_score_catboost_regressor.joblib \
  outputs/model_metrics.json \
  outputs/sample_roi_decision.json
do
  if [[ -e "$path" ]]; then
    echo "FOUND $path"
  else
    echo "MISSING $path"
  fi
done

python3 - <<'PY'
import json
from pathlib import Path

metrics = json.loads(Path("outputs/model_metrics.json").read_text())
decision = json.loads(Path("outputs/sample_roi_decision.json").read_text())

print("Metrics:")
for name, values in metrics.items():
    print(
        f"- {name}: family={values.get('model_family')} "
        f"mae={values.get('mae')} rmse={values.get('rmse')} r2={values.get('r2')}"
    )

print("ROI recommendation:")
print(
    f"- {decision.get('recommendation')} for {decision.get('district')} "
    f"{decision.get('parcel_id')} with score {decision.get('success_score')}/100 "
    f"and margin {decision.get('margin_pct')}%"
)
print(f"- {decision.get('reason')}")
PY

echo "Finished: $(date -Is)"
