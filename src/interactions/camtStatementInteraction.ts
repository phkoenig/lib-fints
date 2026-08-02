import type { CamtStatement } from '../camtStatement.js';
import type { FinTSConfig } from '../config.js';
import type { Message } from '../message.js';
import type { Segment } from '../segment.js';
import { HIECA, type HIECASegment } from '../segments/HIECA.js';
import type { HIECASParameter } from '../segments/HIECAS.js';
import { HKECA, type HKECASegment } from '../segments/HKECA.js';
import { type ClientResponse, CustomerOrderInteraction } from './customerInteraction.js';

export interface CamtStatementResponse extends ClientResponse {
	statements: CamtStatement[];
	/**
	 * The offset to pass to the next call when the bank announced further documents
	 * (answer code 3040), undefined when no more statements are waiting.
	 */
	nextOffset?: string;
}

export interface CamtStatementOptions {
	/**
	 * The camt schema URNs to request. Defaults to everything the bank announced in
	 * HIECAS — the bank then picks one it can serve.
	 */
	camtFormats?: string[];
	/** Fetch one specific statement, only allowed when the bank sets `indexAllowed` */
	number?: number;
	/** The year the statement number refers to */
	year?: number;
	maxEntries?: number;
	/** The offset from a previous response's `nextOffset` */
	offset?: string;
}

/** Turns the latin1 string the parser produced back into the bytes the bank sent. */
function toBytes(binary: string): Uint8Array {
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i) & 0xff;
	}
	return bytes;
}

/**
 * Some banks base64-encode the payload although the field is declared binary — a quirk
 * seen on HIEKP v1 and guarded against for HIEKA as well.
 *
 * Unwrapping only happens when it can be PROVEN: the payload must consist of base64
 * characters only AND decode to something that actually looks like an XML document.
 * Guessing here would be expensive in a specific way — a camt message that gets
 * base64-decoded by mistake turns into bytes that no parser recognises, and the failure
 * surfaces far away from its cause.
 */
function unwrapBase64(bytes: Uint8Array): Uint8Array {
	const text = new TextDecoder('latin1').decode(bytes);

	if (text.trimStart().startsWith('<') || !/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(text)) {
		return bytes;
	}

	try {
		const decoded = Buffer.from(text, 'base64');
		return decoded.toString('latin1').trimStart().startsWith('<')
			? new Uint8Array(decoded)
			: bytes;
	} catch {
		return bytes;
	}
}

/**
 * Fetches electronic account statements as camt.053 (HKECA).
 *
 * DELIBERATELY SEPARATE FROM {@link ElectronicStatementInteraction}, although the two
 * do the same thing at a distance. Folding HKECA into the HKEKA interaction would mean
 * one code path serving two segments whose element order differs from the second field
 * on — and the HKEKA path is in production. A shared path that decodes one of them
 * wrongly does not throw; it shifts fields and hands out the wrong bytes as a document.
 * The cost of the duplication is a file; the cost of the merge would be a class of
 * failure that only shows up in the data.
 */
export class CamtStatementInteraction extends CustomerOrderInteraction {
	constructor(
		public accountNumber: string,
		public options: CamtStatementOptions = {},
	) {
		super(HKECA.Id, HIECA.Id);
	}

	createSegments(init: FinTSConfig): Segment[] {
		const bankAccount = init.getBankAccount(this.accountNumber);
		const version = init.getMaxSupportedTransactionVersion(HKECA.Id);
		if (!version) {
			throw Error(`There is no supported version for business transaction '${HKECA.Id}'`);
		}

		const params = init.getTransactionParameters<HIECASParameter>(HKECA.Id);
		const formats = this.options.camtFormats ?? params?.supportedCamtFormats ?? [];
		if (formats.length === 0) {
			// The specification requires at least one valid camt.053 URN, chosen from the
			// ones the bank announced. Sending the segment without one produces a bank
			// rejection whose message says nothing about the actual cause.
			throw Error(
				`No camt format available for '${HKECA.Id}'. The bank announced none in HIECAS ` +
					`and none was passed in options.camtFormats.`,
			);
		}

		const hkeca: HKECASegment = {
			header: { segId: HKECA.Id, segNr: 0, version: version },
			account: bankAccount,
			camtFormats: formats,
			statementNumber: this.options.number,
			statementYear: this.options.year,
			maxEntries: this.options.maxEntries,
			offset: this.options.offset,
		};

		return [hkeca];
	}

	handleResponse(response: Message, clientResponse: CamtStatementResponse) {
		const segments = response.findAllSegments<HIECASegment>(HIECA.Id);

		clientResponse.statements = segments.map((hieca) => {
			const names = [hieca.name, hieca.name2, hieca.name3].filter((name) => !!name);

			return {
				camtDescriptor: hieca.camtDescriptor,
				from: hieca.timeRange?.from,
				to: hieca.timeRange?.to,
				date: hieca.date,
				year: hieca.year,
				number: hieca.number,
				document: unwrapBase64(toBytes(hieca.booked ?? '')),
				closingInfo: hieca.closingInfo,
				conditionsInfo: hieca.conditionsInfo,
				advertisement: hieca.advertisement,
				iban: hieca.iban,
				bic: hieca.bic,
				accountName: names.length > 0 ? names.join(' ') : undefined,
				receipt: hieca.receipt,
			};
		});

		clientResponse.nextOffset = clientResponse.bankAnswers.find(
			(answer) => answer.code === 3040,
		)?.params?.[0];
	}
}
