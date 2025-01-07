# Datawav

A simple Node.js utility to encode any file into a WAV file and decode WAV files back to their original data.

## Features
- Convert text or binary files into a WAV file format.
- Decode WAV files back into their original data.
- Supports user-friendly CLI prompts.

## Requirements
- Node.js (v14 or newer)
- npm or bun installed

## Installation
1. Clone the repository or copy the `index.js` file.
2. Install dependencies:
   ```bash
   npm install inquirer
   ```

## Usage
1. Run the script:
   ```bash
   node index.js
   ```
2. Follow the prompts:
   - Select **Convert file to WAV** to encode a file.
   - Select **Decode WAV file** to decode a WAV back into its original format.
3. Enter the file paths as prompted.

## Limitations
- Large files may exceed WAV format limits.
- Encoded WAV files are not playable as audio.

## Example
- Convert `example.txt` to `example.txt.wav`.
- Decode `example.txt.wav` back to `example.txt`.