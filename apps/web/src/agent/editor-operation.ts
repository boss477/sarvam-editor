const activeOperations = new WeakSet<object>();

export async function withEditorOperation<T>(
	editor: object,
	operation: () => Promise<T>,
): Promise<T> {
	if (activeOperations.has(editor))
		throw new Error(
			"An editor action is already running. Wait for it to finish.",
		);
	activeOperations.add(editor);
	try {
		return await operation();
	} finally {
		activeOperations.delete(editor);
	}
}

type ProjectContext = { metadata: { id: string } };
type SceneContext = { id: string; tracks: unknown };
type EditorContextSource = {
	project: {
		getActive(): ProjectContext;
		getActiveOrNull(): ProjectContext | null;
	};
	scenes: {
		getActiveScene(): SceneContext;
		getActiveSceneOrNull(): SceneContext | null;
	};
};

export function captureEditorContext(editor: EditorContextSource) {
	const projectId = editor.project.getActive().metadata.id;
	const scene = editor.scenes.getActiveScene();
	const sceneId = scene.id;
	const tracks = scene.tracks;
	return {
		projectId,
		assertCurrent() {
			if (
				editor.project.getActiveOrNull()?.metadata.id !== projectId ||
				editor.scenes.getActiveSceneOrNull()?.id !== sceneId ||
				editor.scenes.getActiveSceneOrNull()?.tracks !== tracks
			)
				throw new Error(
					"The project or timeline changed while this action was running. No pending timeline edits were applied; retry on the current timeline.",
				);
		},
	};
}
