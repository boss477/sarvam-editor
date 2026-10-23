type Command = { id: string; name: string; args: unknown };
type Pending = {
	command: Command;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
	watchdog: ReturnType<typeof setInterval>;
};
type Session = {
	id: string;
	lastSeen: number;
	queue: Command[];
	pending: Map<string, Pending>;
};
const scope = globalThis as typeof globalThis & { bharatSession?: Session };
const SESSION_TTL_MS = 10000;
export function registerSession() {
	if (
		scope.bharatSession &&
		Date.now() - scope.bharatSession.lastSeen <= SESSION_TTL_MS
	)
		throw new Error("Another editor is connected. Disconnect it first.");
	disconnectSession();
	const session: Session = {
		id: crypto.randomUUID(),
		lastSeen: Date.now(),
		queue: [],
		pending: new Map(),
	};
	scope.bharatSession = session;
	return session.id;
}
export function requireSession(id: string) {
	const session = scope.bharatSession;
	if (!session || session.id !== id)
		throw new Error("Editor connection expired. Reconnect.");
	if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
		disconnectSession();
		throw new Error("Editor connection expired. Reconnect.");
	}
	session.lastSeen = Date.now();
	return session;
}
export function disconnectSession() {
	const session = scope.bharatSession;
	if (session)
		for (const pending of session.pending.values()) {
			clearTimeout(pending.timer);
			clearInterval(pending.watchdog);
			pending.reject(new Error("Editor disconnected."));
		}
	delete scope.bharatSession;
}
export async function dispatchTool(name: string, args: unknown) {
	const session = scope.bharatSession;
	if (!session || Date.now() - session.lastSeen > SESSION_TTL_MS) {
		disconnectSession();
		throw new Error(
			"Open a project and enable agent control in the Sarvam panel.",
		);
	}
	if (session.pending.size)
		throw new Error("Editor is busy. Wait for the current action.");
	return new Promise((resolve, reject) => {
		const id = crypto.randomUUID(),
			command = { id, name, args };
		const watchdog = setInterval(() => {
			if (
				scope.bharatSession === session &&
				Date.now() - session.lastSeen > SESSION_TTL_MS
			)
				disconnectSession();
		}, 1000);
		const timer = setTimeout(() => {
			clearInterval(watchdog);
			session.pending.delete(id);
			session.queue = session.queue.filter((c) => c.id !== id);
			reject(
				new Error(
					"Editor action timed out. Inspect the editor before retrying.",
				),
			);
		}, 180000);
		session.pending.set(id, { command, resolve, reject, timer, watchdog });
		session.queue.push(command);
	});
}
export function finishTool(
	id: string,
	commandId: string,
	result: unknown,
	error?: string,
) {
	const session = requireSession(id),
		pending = session.pending.get(commandId);
	if (!pending) return;
	clearTimeout(pending.timer);
	clearInterval(pending.watchdog);
	session.pending.delete(commandId);
	if (error) pending.reject(new Error(error));
	else pending.resolve(result);
}
