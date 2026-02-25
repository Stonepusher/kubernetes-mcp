import { execa, ExecaError } from 'execa';

export interface ShellResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  input?: string,
): Promise<ShellResult> {
  try {
    const result = await execa(command, args, {
      input,
      all: false,
      reject: true,
    });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (err) {
    if (err instanceof Error && 'stderr' in err) {
      const execaErr = err as ExecaError;
      const message = execaErr.stderr || execaErr.stdout || execaErr.message;
      throw new Error(`Command '${command} ${args.join(' ')}' failed: ${message}`);
    }
    throw err;
  }
}
