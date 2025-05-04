from setuptools import setup, find_packages

setup(
    name="poisim",
    version="1.0.0",
    author="Dinesh Gunda",
    description="AI Safety and Jailbreak Detection System",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/POIsim",
    packages=find_packages(),
    install_requires=[
        "torch",
        "transformers",
        "nltk",
        "spacy",
        "textblob",
        "detoxify",
        "google-generativeai",
        "python-dotenv",
        "rich"
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
) 