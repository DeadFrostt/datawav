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
        // Ensure input is a Buffer
        const dataBytes = Buffer.isBuffer(inputData) ? inputData : Buffer.from(inputData);
        
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

        return bytes;
    }
}

async function validatePath(inputPath, isInput = true) {
    try {
        const resolvedPath = path.resolve(inputPath);
        
        if (isInput) {
            // Check if input file exists
            await fs.access(resolvedPath);
            return resolvedPath;
        } else {
            // For output path, ensure directory exists
            const dir = path.dirname(resolvedPath);
            await fs.mkdir(dir, { recursive: true });
            return resolvedPath;
        }
    } catch (error) {
        if (isInput) {
            throw new Error(`Invalid input path: ${inputPath} (${error.message})`);
        } else {
            throw new Error(`Invalid output directory: ${path.dirname(inputPath)} (${error.message})`);
        }
    }
}

async function suggestOutputPath(inputPath, isEncoding = true) {
    const dir = path.dirname(inputPath);
    const fullName = path.basename(inputPath);
    
    if (isEncoding) {
        // For encoding: add .wav to the full filename
        return path.join(dir, `${fullName}.wav`);
    } else {
        // For decoding: remove .wav extension
        if (!fullName.toLowerCase().endsWith('.wav')) {
            throw new Error('Input file must be a WAV file');
        }
        return path.join(dir, fullName.slice(0, -4));
    }
}

async function getOutputPath(suggestedPath) {
    const { useCustomPath } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useCustomPath',
            message: `Default output path is: ${suggestedPath}\nWould you like to specify a different output path?`,
            default: false
        }
    ]);

    if (!useCustomPath) {
        return suggestedPath;
    }

    const { customPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'customPath',
            message: 'Enter your desired output path:',
            validate: async (input) => {
                try {
                    await validatePath(input, false);
                    return true;
                } catch (error) {
                    return error.message;
                }
            }
        }
    ]);

    return customPath;
}

async function main() {
    const converter = new DataToWavConverter();

    while (true) {
        console.clear();
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
            try {
                const { filePath } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'filePath',
                        message: 'Enter the path to the file you want to convert:',
                        validate: async (input) => {
                            try {
                                await validatePath(input, true);
                                return true;
                            } catch (error) {
                                return error.message;
                            }
                        }
                    }
                ]);

                const resolvedInputPath = await validatePath(filePath, true);
                const suggestedOutputPath = await suggestOutputPath(resolvedInputPath, true);
                const outputPath = await getOutputPath(suggestedOutputPath);
                const resolvedOutputPath = await validatePath(outputPath, false);

                const inputData = await fs.readFile(resolvedInputPath);
                const wavBuffer = converter.encodeToWav(inputData);
                
                await fs.writeFile(resolvedOutputPath, wavBuffer);
                console.log(`\nSuccessfully converted! Saved to: ${resolvedOutputPath}`);
            } catch (error) {
                console.error('\nError converting file:', error.message);
            }
        }

        if (action === 'Decode WAV file') {
            try {
                const { filePath } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'filePath',
                        message: 'Enter the path to the WAV file:',
                        validate: async (input) => {
                            if (!input.toLowerCase().endsWith('.wav')) {
                                return 'Please provide a WAV file';
                            }
                            try {
                                await validatePath(input, true);
                                return true;
                            } catch (error) {
                                return error.message;
                            }
                        }
                    }
                ]);

                const resolvedInputPath = await validatePath(filePath, true);
                const suggestedOutputPath = await suggestOutputPath(resolvedInputPath, false);
                const outputPath = await getOutputPath(suggestedOutputPath);
                const resolvedOutputPath = await validatePath(outputPath, false);

                const wavData = await fs.readFile(resolvedInputPath);
                const decodedData = converter.decodeFromWav(wavData);
                
                await fs.writeFile(resolvedOutputPath, decodedData);
                console.log(`\nSuccessfully decoded! Saved to: ${resolvedOutputPath}`);
            } catch (error) {
                console.error('\nError decoding file:', error.message);
            }
        }

        //pause before next action
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to continue...',
            }
        ]);
    }
}

main().catch(console.error);