// index.js
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';

class DataToWavConverter {
    constructor() {
        this.sampleRate = 44100;
        this.numChannels = 1;
        this.bitsPerSample = 16;
    }

    encodeToWav(inputData) {
        // Convert input data to bytes if it's not already
        const dataBytes = Buffer.isBuffer(inputData) ? 
            inputData : 
            Buffer.from(typeof inputData === 'string' ? inputData : JSON.stringify(inputData));
        
        // Create audio samples from bytes
        const samples = new Int16Array(dataBytes.length);
        for (let i = 0; i < dataBytes.length; i++) {
            samples[i] = ((dataBytes[i] / 255) * 65535 - 32768);
        }
        
        // Calculate sizes
        const dataSize = samples.length * (this.bitsPerSample / 8);
        const fmtChunkSize = 16;
        const fileSize = 44 + dataSize;

        // Create WAV file buffer
        const buffer = Buffer.alloc(fileSize);
        let offset = 0;

        // Write WAV header
        buffer.write('RIFF', offset); offset += 4;
        buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
        buffer.write('WAVE', offset); offset += 4;

        // fmt sub-chunk
        buffer.write('fmt ', offset); offset += 4;
        buffer.writeUInt32LE(fmtChunkSize, offset); offset += 4;
        buffer.writeUInt16LE(1, offset); offset += 2;
        buffer.writeUInt16LE(this.numChannels, offset); offset += 2;
        buffer.writeUInt32LE(this.sampleRate, offset); offset += 4;
        buffer.writeUInt32LE(this.sampleRate * this.numChannels * (this.bitsPerSample / 8), offset); offset += 4;
        buffer.writeUInt16LE(this.numChannels * (this.bitsPerSample / 8), offset); offset += 2;
        buffer.writeUInt16LE(this.bitsPerSample, offset); offset += 2;

        // data sub-chunk
        buffer.write('data', offset); offset += 4;
        buffer.writeUInt32LE(dataSize, offset); offset += 4;

        // Write audio data
        for (let i = 0; i < samples.length; i++) {
            buffer.writeInt16LE(samples[i], offset);
            offset += 2;
        }

        return buffer;
    }

    decodeFromWav(wavBuffer) {
        // Skip WAV header (44 bytes)
        const offset = 44;
        const dataSize = (wavBuffer.length - offset) / 2;
        
        const samples = new Int16Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            samples[i] = wavBuffer.readInt16LE(offset + i * 2);
        }

        const bytes = Buffer.alloc(samples.length);
        for (let i = 0; i < samples.length; i++) {
            bytes[i] = Math.round(((samples[i] + 32768) / 65535) * 255);
        }

        try {
            // Try to parse as JSON first
            return JSON.parse(bytes.toString());
        } catch {
            // If not JSON, return as string
            return bytes.toString();
        }
    }
}

async function main() {
    const converter = new DataToWavConverter();

    while (true) {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    'Convert file to WAV',
                    'Decode WAV file',
                    'Exit'
                ]
            }
        ]);

        if (action === 'Exit') {
            break;
        }

        if (action === 'Convert file to WAV') {
            const { filePath } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'filePath',
                    message: 'Enter the path to the file you want to convert:'
                }
            ]);

            try {
                const inputData = await fs.readFile(filePath);
                const wavBuffer = converter.encodeToWav(inputData);
                const outputPath = path.join(
                    path.dirname(filePath),
                    `${path.basename(filePath)}.wav`
                );
                await fs.writeFile(outputPath, wavBuffer);
                console.log(`Successfully converted! Saved to: ${outputPath}`);
            } catch (error) {
                console.error('Error converting file:', error.message);
            }
        }

        if (action === 'Decode WAV file') {
            const { filePath, outputPath } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'filePath',
                    message: 'Enter the path to the WAV file:'
                },
                {
                    type: 'input',
                    name: 'outputPath',
                    message: 'Enter the path where you want to save the decoded file (including file name):'
                }
            ]);
        
            try {
                const wavData = await fs.readFile(filePath);
                const decodedData = converter.decodeFromWav(wavData);
        
                // Ensure decoded data is saved as a valid file
                const outputFilePath = path.extname(outputPath) ? outputPath : path.join(outputPath, 'decoded_output.txt');
        
                await fs.writeFile(outputFilePath, decodedData);
                console.log(`Successfully decoded! Saved to: ${outputFilePath}`);
            } catch (error) {
                console.error('Error decoding file:', error.message);
            }
        }
    }        }
main().catch(console.error);