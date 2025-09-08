#!/usr/bin/env python3
"""
Invoice Service Setup Script
Run this script to set up and install the invoice processing service
"""

import os
import sys
import subprocess
import shutil

def run_command(command, description):
    """Run a shell command and handle errors"""
    print(f"\n🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def main():
    print("🚀 Invoice Processing Service Setup")
    print("=" * 50)

    # Check Python version
    python_version = sys.version_info
    if python_version < (3, 8):
        print(f"❌ Python {python_version.major}.{python_version.minor} is not supported. Please use Python 3.8 or higher.")
        return False

    print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.minor} detected")

    # Check if .env file exists
    if not os.path.exists('.env'):
        print("❌ .env file not found!")
        print("Please copy env-template.txt to .env and fill in your API keys:")
        print("cp env-template.txt .env")
        return False

    print("✅ Environment file found")

    # Create necessary directories
    directories = ['exports', 'logs', 'tmp']
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"✅ Created directory: {directory}")

    # Install dependencies
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        return False

    # Test imports
    try:
        print("\n🔧 Testing imports...")
        import fastapi
        import anthropic
        import openai
        from agentic_doc.parse import parse
        print("✅ All required packages imported successfully!")
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Please check your requirements.txt and try again")
        return False

    # Test environment variables
    from dotenv import load_dotenv
    load_dotenv()

    required_vars = [
        'ANTHROPIC_API_KEY',
        'LANDING_AI_API_KEY',
        'VISION_AGENT_API_KEY'
    ]

    missing_vars = []
    for var in required_vars:
        if not os.getenv(var) or os.getenv(var) == f'your-{var.lower().replace("_", "-")}-here':
            missing_vars.append(var)

    if missing_vars:
        print(f"\n⚠️  Missing or placeholder API keys: {', '.join(missing_vars)}")
        print("Please update your .env file with actual API keys")
        print("The service will still work but some features may be limited")

    print("\n🎉 Setup completed successfully!")
    print("\n🚀 To start the service:")
    print("python -m uvicorn app.main:app --host 0.0.0.0 --port 8080")
    print("\n📖 API Documentation will be available at:")
    print("http://localhost:8080/docs")
    print("\n🧪 Test the service:")
    print("curl http://localhost:8080/health")

    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
