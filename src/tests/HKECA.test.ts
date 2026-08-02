import { describe, expect, it } from 'vitest';
import {
	CamtStatementInteraction,
	type CamtStatementResponse,
} from '../interactions/camtStatementInteraction.js';
import { Message } from '../message.js';
import { decode, encode } from '../segment.js';
import type { HIECASegment } from '../segments/HIECA.js';
import type { HIECASSegment } from '../segments/HIECAS.js';
import { HKECA, type HKECASegment } from '../segments/HKECA.js';
import { registerSegments } from '../segments/registry.js';

registerSegments();

const CAMT053 = 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.02';
const CAMT053_08 = 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08';
// Auf dem Draht wird jedes ':' im WERT maskiert — sonst waere es ein Trenner.
const CAMT053_ESC = CAMT053.replaceAll(':', '?:');
const CAMT053_08_ESC = CAMT053_08.replaceAll(':', '?:');

describe('HKECA v1', () => {
	it('encode', () => {
		const segment: HKECASegment = {
			header: { segId: HKECA.Id, segNr: 3, version: 1 },
			account: { iban: 'DE991234567123456', bic: 'BANK12' },
			camtFormats: [CAMT053],
		};

		expect(encode(segment)).toBe(`HKECA:3:1+DE991234567123456:BANK12+${CAMT053_ESC}'`);
	});

	it('encodes several camt descriptors into ONE data group', () => {
		// The bank may announce more than one schema; the client sends the ones it can
		// read. They belong into a single data group separated by ':', not into
		// separate data elements — a decoder reading them as separate elements would
		// shift statementNumber and everything after it.
		const segment: HKECASegment = {
			header: { segId: HKECA.Id, segNr: 3, version: 1 },
			account: { iban: 'DE991234567123456', bic: 'BANK12' },
			camtFormats: [CAMT053, CAMT053_08],
			statementNumber: 7,
		};

		expect(encode(segment)).toBe(
			`HKECA:3:1+DE991234567123456:BANK12+${CAMT053_ESC}:${CAMT053_08_ESC}+7'`,
		);
	});

	it('encode with statement number, year and offset', () => {
		const segment: HKECASegment = {
			header: { segId: HKECA.Id, segNr: 3, version: 1 },
			account: { iban: 'DE991234567123456', bic: 'BANK12' },
			camtFormats: [CAMT053],
			statementNumber: 7,
			statementYear: 2026,
			offset: '20260530120235141058000_0',
		};

		expect(encode(segment)).toBe(
			`HKECA:3:1+DE991234567123456:BANK12+${CAMT053_ESC}+7+2026++20260530120235141058000_0'`,
		);
	});

	it('decode and encode roundtrip matches', () => {
		const text = `HKECA:0:1+DE991234567123456:BANK12+${CAMT053_ESC}+7+2026++20260530120235141058000_0'`;
		expect(encode(decode(text))).toBe(text);
	});
});

describe('HIECA v1', () => {
	// THE RISK OF THIS SEGMENT is that it looks like HIEKA and is not: element 2 is the
	// camt descriptor (an ..25), not a one-character format code. Reusing HIEKA's layout
	// would not fail loudly — it would shift every following field by one.
	const text =
		"HIECA:5:1+camt.053.001.02+20260601:20260630+20260701+2026+7+@25@<Document>test</Document>+Abschluss+Konditionen+Werbung+DE991234567123456+BANK12+Muster+GmbH+i?:G?:+@4@abcd'";

	it('decode', () => {
		const segment = decode(text) as HIECASegment;

		expect(segment.camtDescriptor).toBe('camt.053.001.02');
		expect(segment.timeRange?.from).toEqual(new Date('2026-06-01'));
		expect(segment.timeRange?.to).toEqual(new Date('2026-06-30'));
		expect(segment.date).toEqual(new Date('2026-07-01'));
		expect(segment.year).toBe(2026);
		expect(segment.number).toBe(7);
		expect(segment.booked).toBe('<Document>test</Document>');
		expect(segment.closingInfo).toBe('Abschluss');
		expect(segment.conditionsInfo).toBe('Konditionen');
		expect(segment.advertisement).toBe('Werbung');
		expect(segment.iban).toBe('DE991234567123456');
		expect(segment.bic).toBe('BANK12');
		expect(segment.receipt).toBe('abcd');
	});

	it('decodes an open time range — only the start date is mandatory in version 2', () => {
		const segment = decode(
			"HIECA:5:1+camt.053.001.02+20260601++++@25@<Document>test</Document>'",
		) as HIECASegment;

		expect(segment.timeRange?.from).toEqual(new Date('2026-06-01'));
		expect(segment.timeRange?.to).toBeUndefined();
		expect(segment.booked).toBe('<Document>test</Document>');
	});
});

describe('HIECAS v1', () => {
	it('decodes the camt schema URNs as full strings, not as single characters', () => {
		// The trap this test exists for: HIEKAS declares its fourth element as a
		// one-character CODE, HIECAS as an URN of up to 256 characters. A definition
		// copied over from HIEKAS truncates every URN to its first character — and the
		// request built from it is rejected by the bank with a message that says nothing
		// about the cause.
		const segment = decode(
			`HIECAS:6:1:4+1+1+0+J:N:J:${CAMT053_ESC}'`,
		) as HIECASSegment;

		expect(segment.params.indexAllowed).toBe(true);
		expect(segment.params.receiptRequired).toBe(false);
		expect(segment.params.maxEntryCountAllowed).toBe(true);
		expect(segment.params.supportedCamtFormats).toEqual([CAMT053]);
	});
});

describe('CamtStatementInteraction', () => {
	function response(text: string): CamtStatementResponse {
		const message = Message.decode(text);
		const clientResponse = { bankAnswers: message.getBankAnswers() } as never;
		new CamtStatementInteraction('123').handleResponse(message, clientResponse);
		return clientResponse as unknown as CamtStatementResponse;
	}

	it('hands out the camt message as bytes', () => {
		const result = response(
			"HNHBK:1:3+000000000100+300+0+1'" +
				"HIECA:2:1+camt.053.001.02+20260601:20260630++++@25@<Document>test</Document>'" +
				"HNHBS:3:1+1'",
		);

		expect(result.statements).toHaveLength(1);
		expect(new TextDecoder().decode(result.statements[0].document)).toBe(
			'<Document>test</Document>',
		);
		expect(result.statements[0].camtDescriptor).toBe('camt.053.001.02');
	});

	it('leaves a document that is not base64 untouched', () => {
		// An XML document consists of base64-safe characters far more often than a PDF
		// does. Unwrapping on suspicion would turn a valid camt message into bytes no
		// parser recognises — and the failure would surface far from its cause.
		const result = response(
			"HNHBK:1:3+000000000100+300+0+1'" +
				"HIECA:2:1+camt.053.001.02+20260601:20260630++++@8@Doc=test'" +
				"HNHBS:3:1+1'",
		);

		expect(new TextDecoder().decode(result.statements[0].document)).toBe('Doc=test');
	});
});
