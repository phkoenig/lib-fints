import { describe, expect, it } from 'vitest';
import { CamtParser } from '../camtParser.js';

/**
 * Why this test exists (2026-08-03): the first HKECA fetch against the live HVB
 * delivered camt.053 documents — root `BkToCstmrStmt/Stmt` — and the parser,
 * written for camt.052 (`BkToCstmrAcctRpt/Rpt`), rejected them as "no valid
 * CAMT document structure". The inner shape (Acct/Bal/Ntry) is identical; only
 * the wrapper differs. The XML below is a condensed verbatim cut of the real
 * statement of 2024-07-24 (account DE29100208900356357361, two of four
 * entries, balances adjusted to keep the chain exact).
 */
describe('CamtParser camt.053 (BkToCstmrStmt)', () => {
	const camt053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
<BkToCstmrStmt>
<GrpHdr><MsgId>20240724230733192016</MsgId><CreDtTm>2024-07-24T19:00:00.000+02:00</CreDtTm></GrpHdr>
<Stmt>
<Id>34894035635736120240724230733192016</Id>
<ElctrncSeqNb>110</ElctrncSeqNb>
<Acct><Id><IBAN>DE29100208900356357361</IBAN></Id><Ccy>EUR</Ccy><Nm>WG-Konto</Nm></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">91.46</Amt><CdtDbtInd>DBIT</CdtDbtInd><Dt><Dt>2024-07-24</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">99.96</Amt><CdtDbtInd>DBIT</CdtDbtInd><Dt><Dt>2024-07-24</Dt></Dt></Bal>
<Ntry><Amt Ccy="EUR">3.50</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts>
<BookgDt><Dt>2024-07-24</Dt></BookgDt><ValDt><Dt>2024-07-24</Dt></ValDt>
<NtryDtls><TxDtls><Refs><EndToEndId>ZAA0149783468</EndToEndId></Refs>
<RltdPties><Dbtr><Pty><Nm>PHILIP KOENIG</Nm></Pty></Dbtr></RltdPties></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="EUR">5.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts>
<BookgDt><Dt>2024-07-24</Dt></BookgDt><ValDt><Dt>2024-07-24</Dt></ValDt></Ntry>
</Stmt>
</BkToCstmrStmt>
</Document>`;

	it('parses a camt.053 statement that the camt.052-only parser rejected', () => {
		const parser = new CamtParser(camt053);
		const statements = parser.parse();
		expect(statements).toHaveLength(1);
		expect(statements[0].account).toBe('DE29100208900356357361');
	});

	it('keeps the official balances usable as anchors — the whole point of the fetch', () => {
		const [s] = new CamtParser(camt053).parse();
		expect(s.openingBalance?.value).toBe(-91.46); // DBIT ⇒ negative
		expect(s.closingBalance?.value).toBe(-99.96);
		expect(s.transactions).toHaveLength(2);
		const summe = s.transactions.reduce((a, t) => a + t.amount, 0);
		// The statement's own chain must close: OPBD + entries = CLBD
		expect(Math.round((s.openingBalance!.value + summe) * 100)).toBe(
			Math.round(s.closingBalance!.value * 100),
		);
	});
});
