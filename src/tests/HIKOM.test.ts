import { describe, expect, it } from 'vitest';
import { decode } from '../segment.js';
import type { HIKOMSegment } from '../segments/HIKOM.js';
import { registerSegments } from '../segments/registry.js';

registerSegments();

/**
 * Why this test exists (2026-08-03): HVB's BPD carries TWO communication
 * accesses in HIKOM — service 2 first, the HTTPS one (service 3) second.
 * With comParams capped at maxCount 1 only the first entry survived decoding,
 * the client adopted `https://hbci.hypovereinsbank.de/` as its banking URL,
 * and every dialog after the first one hit a web portal that answered with an
 * HTML redirect page. Base64-decoding that page produced garbage which then
 * failed deep inside the segment parser — three layers away from the cause.
 */
describe('HIKOM v4', () => {
	// Verbatim shape of the segment the live HVB sent on 2026-08-03.
	const hvb =
		"HIKOM:7:4:4+280:70020270+1+2:hbci.hypovereinsbank.de+3:https?://hbci-01.hypovereinsbank.de/bank/hbci'";

	it('decodes every communication access, not just the first', () => {
		const segment = decode(hvb) as HIKOMSegment;
		expect(Array.isArray(segment.comParams)).toBe(true);
		expect(segment.comParams).toHaveLength(2);
	});

	it('keeps service and address per access, with FinTS escaping resolved', () => {
		const segment = decode(hvb) as HIKOMSegment;
		expect(Number(segment.comParams[0].service)).toBe(2);
		expect(segment.comParams[0].address).toBe('hbci.hypovereinsbank.de');
		expect(Number(segment.comParams[1].service)).toBe(3);
		// `https?://` in the wire format is the escaped form of `https://`
		expect(segment.comParams[1].address).toBe('https://hbci-01.hypovereinsbank.de/bank/hbci');
	});

	it('still decodes a single-access HIKOM (the VR shape) as a one-element list', () => {
		const vr =
			"HIKOM:5:4:3+280:10090000+1+3:https?://fints2.atruvia.de/cgi-bin/hbciservlet'";
		const segment = decode(vr) as HIKOMSegment;
		expect(segment.comParams).toHaveLength(1);
		expect(Number(segment.comParams[0].service)).toBe(3);
		expect(segment.comParams[0].address).toBe('https://fints2.atruvia.de/cgi-bin/hbciservlet');
	});
});
