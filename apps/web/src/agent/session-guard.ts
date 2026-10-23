type ProjectSource = {
	project: {
		getActive(): { metadata: { id: string } };
		getActiveOrNull(): { metadata: { id: string } } | null;
	};
};

export function createAgentSessionGuard(editor: ProjectSource) {
	const projectId = editor.project.getActive().metadata.id;
	let cancelled = false;
	return {
		cancel() {
			cancelled = true;
		},
		assertCurrent() {
			if (cancelled)
				throw new Error("Agent connection closed. Reconnect before editing.");
			if (editor.project.getActiveOrNull()?.metadata.id !== projectId) {
				cancelled = true;
				throw new Error(
					"The connected project changed. Reconnect before editing.",
				);
			}
		},
	};
}
