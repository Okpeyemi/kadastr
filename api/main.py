from openai import OpenAI
import base64
from pathlib import Path
import csv
import re

# -----------------------------
# Configure OpenRouter client
# -----------------------------
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="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",
)

# -----------------------------
# Encode image to base64
# -----------------------------
def encode_image_to_base64(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

CURRENT = Path(__file__).resolve().parent
file_path = CURRENT / "data" / "leve4.jpeg"  # replace with your image or PDF
encoded_file = encode_image_to_base64(file_path)
data_url = f"data:image/jpeg;base64,{encoded_file}"

# -----------------------------
# Send to OpenRouter model
# -----------------------------
completion = client.chat.completions.create(
    extra_body={},
    model="google/gemini-2.0-flash-exp:free",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract a table of Parcelle, X, Y coordinates from this image in CSV format."},
                {"type": "image_url", "image_url": {"url": data_url}}
            ]
        }
    ]
)

# -----------------------------
# Get AI response
# -----------------------------
ai_text = completion.choices[0].message.content
print("AI Output:\n", ai_text)

# -----------------------------
# Parse AI output and save CSV
# -----------------------------
# Simple regex to extract lines like: B1,427094.70,712773.67
rows = re.findall(r"(B\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)", ai_text)

if rows:
    csv_file = CURRENT / "parcelles.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Parcelle", "X", "Y"])
        writer.writerows(rows)
    print(f"\nCSV saved at: {csv_file}")
else:
    print("\nNo valid rows found in AI output.")
