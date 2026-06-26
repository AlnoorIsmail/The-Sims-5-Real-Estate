import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const decisionPath = path.join(process.cwd(), "outputs", "sample_roi_decision.json");
const runCommand =
  "python ml_pipeline/train_models.py && python ml_pipeline/predict_and_score.py";

export async function GET() {
  try {
    const file = await fs.readFile(decisionPath, "utf-8");
    const decision = JSON.parse(file);

    return NextResponse.json({
      ready: true,
      decision,
    });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (error.code === "ENOENT") {
      return NextResponse.json({
        ready: false,
        message:
          "No prepared recommendation was found. Run the local ML pipeline first.",
        command: runCommand,
      });
    }

    return NextResponse.json(
      {
        ready: false,
        message: "Could not read the prepared recommendation artifact.",
        detail: error.message,
      },
      { status: 500 },
    );
  }
}
