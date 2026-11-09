// En lille farvet mærkat med en position, fx "VB · Venstre back"
import { ROLLER } from "../data/konstanter.js";

export default function RolleChip({ kode }) {
  const rolle = ROLLER[kode];
  if (!rolle) return null;
  return (
    <span className="rolle-chip" style={{ "--rollefarve": rolle.farve }}>
      {kode} · {rolle.navn}
    </span>
  );
}
