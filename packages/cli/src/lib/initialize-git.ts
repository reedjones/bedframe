import { execa } from 'execa'
import { chdir, cwd } from 'node:process'
import { PromptsResponse } from './prompts'

export async function initializeGitProject(
  response: PromptsResponse
): Promise<void> {
  const projectPath = response.extension.name.path ?? cwd()
  const projectName = response.extension.name.name ?? 'bedframe-project'

  try {
    chdir(projectPath)
    await execa('git', ['init'])
    await execa('git', ['add', '.'])
    await execa('git', [
      'commit',
      '-am',
      `feat(${projectName}): initial commit. configure BEDframe`,
    ])
  } catch (error) {
    console.error(error)
  }
  console.groupEnd()
}
