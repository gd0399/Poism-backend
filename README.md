# POIsim - AI Safety and Jailbreak Detection System

POIsim is an advanced AI safety system designed to detect and prevent harmful content generation, jailbreak attempts, and unethical AI interactions. The system uses a combination of machine learning models, pattern recognition, and safety protocols to ensure AI responses remain within ethical boundaries.

## Features

- Jailbreak attempt detection
- Harmful content classification
- Toxicity analysis
- Context-aware safety measures
- Real-time response monitoring
- Conversation history tracking
- Multi-model safety verification

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Virtual environment (recommended)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/muralikrish9/POIsim.git
cd POIsim
```

2. Create and activate a virtual environment:
```bash
# On Windows
python -m venv venv
.\venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

3. Install required packages:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
   - Create a `.env` file in the project root
   - Add your Google API key:
```
GOOGLE_API_KEY=your_api_key_here
```

## Project Structure

```
POIsim/
├── classifier/
│   ├── jailbreak_detector.py    # Main jailbreak detection logic
│   └── ...
├── data/
│   └── conversation_history.json # Conversation logs
├── requirements.txt             # Project dependencies
├── .env                         # Environment variables
└── README.md                    # Project documentation
```

## Usage

1. Run the test script to verify the system:
```bash
python test_trained_model.py
```

2. The system will analyze various types of prompts:
   - Harmful content attempts
   - Jailbreak attempts
   - Safe queries
   - Educational content

3. Results will be displayed with:
   - Jailbreak probability
   - Content classification
   - Risk factors
   - Toxicity analysis
   - Model response state

## Safety Features

- **Content Classification**: Identifies harmful, illegal, or unethical content
- **Pattern Recognition**: Detects common jailbreak attempts and evasion patterns
- **Toxicity Analysis**: Measures harmful content using multiple metrics
- **Context Awareness**: Considers conversation history for better detection
- **Multi-Model Verification**: Uses multiple models for enhanced safety

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google AI for API access
- Hugging Face for model support
- OpenAI for inspiration and safety guidelines 