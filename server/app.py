from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_NAME = "bhadresh-savani/distilbert-base-uncased-emotion"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
emotion_pipeline = pipeline(
    "text-classification", model=model, tokenizer=tokenizer, return_all_scores=True
)


@app.route("/analyze_bulk", methods=["POST"])
def analyze_bulk():
    """
    Analyze multiple text blocks with IDs at once.
    Expects: { "items": [ { "id": "abc123", "text": "..." }, ... ] }
    Returns: [ { "id": "abc123", "mood": "joy", "confidence": 0.9, "scores": {...} }, ... ]
    """
    data = request.get_json()
    if not data or "items" not in data or not isinstance(data["items"], list):
        return jsonify({"error": "Missing or invalid 'items' list."}), 400

    responses = []

    for item in data["items"]:
        _id = item.get("id")
        text = item.get("text", "").strip()
        if not text:
            responses.append(
                {"id": _id, "mood": "nonchalantahh", "confidence": 0.0, "scores": {}}
            )
            continue

        # split text into chunks if too long (models have limits)
        max_len = 512
        chunks = [text[i : i + max_len] for i in range(0, len(text), max_len)]

        all_results = []
        for chunk in chunks:
            all_results.extend(emotion_pipeline(chunk))

        emotion_scores = {}
        for result in all_results:
            for item_ in result:
                emotion_scores[item_["label"]] = (
                    emotion_scores.get(item_["label"], 0) + item_["score"]
                )

        for label in emotion_scores:
            emotion_scores[label] /= len(all_results)

        top_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = round(emotion_scores[top_emotion], 3)

        responses.append(
            {
                "id": _id,
                "mood": top_emotion,
                "confidence": confidence,
                "scores": {
                    k: round(v, 3)
                    for k, v in sorted(
                        emotion_scores.items(), key=lambda x: x[1], reverse=True
                    )
                },
            }
        )

    return jsonify(responses)


@app.route("/", methods=["GET"])
def index():
    return jsonify({"message": "MoodLens Emotion API is running!"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
