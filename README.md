# POIsim - AI Safety and Jailbreak Detection System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![PyPI version](https://badge.fury.io/py/poisim.svg)](https://badge.fury.io/py/poisim)
[![Documentation Status](https://readthedocs.org/projects/poisim/badge/?version=latest)](https://poisim.readthedocs.io/en/latest/?badge=latest)

A powerful AI safety system designed to detect and prevent harmful content, jailbreak attempts, and unethical AI interactions. POIsim helps ensure AI systems remain safe and ethical by analyzing prompts and detecting potential risks.

## 🚀 Quick Start

### Installation

```bash
# Install from PyPI
pip install poisim

# Or install from source
git clone https://github.com/muralikrish9/POIsim.git
cd POIsim
pip install -e .
```

### Basic Usage

```python
from poisim import JailbreakDetector

# Initialize detector
detector = JailbreakDetector()

# Analyze a prompt
result = detector.predict("Your text here")

# View results
print(f"Safety Score: {result.score}")
print(f"Nature: {result.nature}")
print(f"Explanation: {result.explanation}")
```

## 🌟 Features

- 🛡️ **Multi-Model Analysis**: Combines BERT, Gemini, Detoxify, SpaCy, and TextBlob
- 🔍 **Advanced Detection**: Identifies jailbreak attempts and harmful content
- 📊 **Comprehensive Analysis**: Detailed safety scoring and explanations
- 🧠 **Context-Aware**: Understands conversation history and context
- 📝 **Detailed Reports**: Provides comprehensive analysis results
- 🚫 **Real-time Prevention**: Blocks harmful content before processing

## 📋 Requirements

- Python 3.8 or higher
- Gemini API key
- Internet connection for model downloads
- 4GB RAM minimum (8GB recommended)
- 2GB free storage
- NVIDIA GPU with CUDA support (optional, for better performance)

## 🔧 Setup

1. **Environment Setup**:
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **API Key Setup**:
Create a `.env` file:
```bash
GEMINI_API_KEY=your_api_key_here
```

3. **Model Download**:
```bash
python download_model.py
```

## 📚 Documentation

For detailed documentation, visit our [documentation site](https://poisim.readthedocs.io/).

## 🎯 Use Cases

- **AI Safety**: Prevent harmful content generation
- **Content Moderation**: Filter inappropriate content
- **Research**: Study AI safety and jailbreak patterns
- **Development**: Integrate safety checks into AI applications

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📚 [Documentation](https://poisim.readthedocs.io/)
- 💬 [Discussions](https://github.com/muralikrish9/POIsim/discussions)
- 🐛 [Issue Tracker](https://github.com/muralikrish9/POIsim/issues)

## 📝 Citation

If you use POIsim in your research, please cite:

```bibtex
@software{poisim2024,
  author = {Dinesh Gunda},
  title = {POIsim: AI Safety and Jailbreak Detection System},
  year = {2024},
  url = {https://github.com/muralikrish9/POIsim}
}
```

## 🙏 Acknowledgments

- Google AI
- Hugging Face
- Open-source community
- AI Safety Research Community 