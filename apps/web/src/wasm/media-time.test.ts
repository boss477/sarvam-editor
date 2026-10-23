import { expect, test } from "bun:test";
import {
	mediaTime,
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	roundFrameTime,
	TICKS_PER_SECOND,
} from "./media-time";

test("real WASM converts fractional seconds to integer ticks and back", () => {
	expect(TICKS_PER_SECOND).toBeGreaterThan(0);
	const time = mediaTimeFromSeconds({ seconds: 1.25 });
	expect(time).toBe(mediaTime({ ticks: TICKS_PER_SECOND * 1.25 }));
	expect(Number.isInteger(time)).toBe(true);
	expect(mediaTimeToSeconds({ time })).toBe(1.25);
	expect(() => mediaTime({ ticks: 1.25 })).toThrow("integer tick count");
});

test("real WASM snaps timeline time to a frame boundary", () => {
	const time = mediaTimeFromSeconds({ seconds: 0.049 });
	const snapped = roundFrameTime({
		time,
		fps: { numerator: 30, denominator: 1 },
	});
	expect(Number.isInteger(snapped)).toBe(true);
	expect(mediaTimeToSeconds({ time: snapped })).toBeCloseTo(1 / 30, 6);
});
