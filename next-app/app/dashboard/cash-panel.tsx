"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleDollarSign,
  History,
  LockKeyhole,
  X,
} from "lucide-react";
import {
  closeCashRegister,
  openCashRegister,
  recordCashMovement,
} from "@/lib/cash/actions";
import {
  calculateDifference,
  calculateExpectedCash,
  cashMovementLabels,
  type CashData,
} from "@/lib/cash/types";

type Props = CashData;
type Notice = { kind: "success" | "error"; text: string } | null;
const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CashPanel({
  register: initialRegister,
  movements: initialMovements,
  error: initialError,
}: Props) {
  const [register, setRegister] = useState(initialRegister);
  const [movements, setMovements] = useState(initialMovements);
  const [mode, setMode] = useState<"open" | "movement" | "close">("open");
  const [notice, setNotice] = useState<Notice>(
    initialError ? { kind: "error", text: initialError } : null
  );
  const [isPending, startTransition] = useTransition();
  const expected = useMemo(
    () =>
      register
        ? calculateExpectedCash(
            register.opening_cents,
            movements.filter(movement => movement.movement_type !== "opening")
          )
        : 0,
    [register, movements]
  );

  function submit(
    event: React.FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<any>
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const result = await action(new FormData(form));
      if (result.ok) {
        if (mode === "open") {
          setRegister(result.data);
          setMovements([
            {
              id: `opening-${Date.now()}`,
              company_id: result.data.company_id,
              cash_register_id: result.data.id,
              sale_id: null,
              movement_type: "opening",
              amount_cents: result.data.opening_cents,
              description: "Saldo inicial",
              created_by: result.data.opened_by,
              created_at: result.data.opened_at,
            },
            ...movements,
          ]);
        }
        if (mode === "movement") {
          setMovements(current => [result.data, ...current]);
        }
        if (mode === "close") {
          setRegister(result.data);
        }
        setMode(mode === "open" ? "movement" : mode);
        form.reset();
      }
      setNotice(
        result.ok
          ? { kind: "success", text: result.message }
          : { kind: "error", text: result.error }
      );
    });
  }

  if (!register)
    return (
      <div className="view-stack fade-in cash-view">
        <div className="hero-row">
          <div>
            <span className="eyebrow">Operação financeira</span>
            <h2>Abra o caixa para começar.</h2>
            <p>Informe o dinheiro disponível no início do turno.</p>
          </div>
          <div className="cash-status closed">
            <i /> Caixa fechado
          </div>
        </div>
        {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
        <section className="panel cash-open-card">
          <div className="cash-big-icon">
            <CircleDollarSign size={30} />
          </div>
          <h3>Abertura de caixa</h3>
          <p>
            O saldo inicial será registrado no histórico e usado no cálculo do
            fechamento.
          </p>
          <form
            className="cash-form compact"
            onSubmit={event => submit(event, openCashRegister)}
          >
            <label>
              Saldo inicial
              <input
                name="opening"
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
                required
              />
            </label>
            <label>
              Observação{" "}
              <textarea
                name="notes"
                rows={3}
                placeholder="Ex.: turno da manhã, conferência inicial…"
              />
            </label>
            <button className="primary-button" disabled={isPending}>
              {isPending ? (
                "Abrindo…"
              ) : (
                <>
                  Abrir caixa <ArrowUpFromLine size={16} />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    );

  const difference =
    register.status === "open" ? 0 : (register.difference_cents ?? 0);
  return (
    <div className="view-stack fade-in cash-view">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Operação financeira</span>
          <h2>
            {register.status === "open"
              ? "Caixa em operação."
              : "Caixa encerrado."}
          </h2>
          <p>
            {register.status === "open"
              ? "Acompanhe o saldo e registre entradas ou saídas."
              : "Confira o resultado do último fechamento."}
          </p>
        </div>
        <div className={`cash-status ${register.status}`}>
          <i /> {register.status === "open" ? "Caixa aberto" : "Caixa fechado"}
        </div>
      </div>
      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
      <div className="cash-stats">
        <div className="panel cash-stat">
          <span>Saldo inicial</span>
          <strong>{money(register.opening_cents)}</strong>
        </div>
        <div className="panel cash-stat">
          <span>Saldo esperado</span>
          <strong>
            {money(
              register.status === "open"
                ? expected
                : (register.expected_cents ?? expected)
            )}
          </strong>
        </div>
        <div className="panel cash-stat">
          <span>{register.status === "open" ? "Movimentos" : "Diferença"}</span>
          <strong
            className={
              difference < 0
                ? "cash-negative"
                : difference > 0
                  ? "cash-positive"
                  : ""
            }
          >
            {register.status === "open" ? movements.length : money(difference)}
          </strong>
        </div>
      </div>
      {register.status === "open" && (
        <div className="cash-actions">
          <section className="panel cash-action-card">
            <div className="cash-action-icon in">
              <ArrowUpFromLine size={20} />
            </div>
            <h3>Entrada ou saída</h3>
            <p>Registre sangria, suprimento ou outra movimentação manual.</p>
            <button
              className="primary-button"
              onClick={() => setMode("movement")}
            >
              Novo movimento
            </button>
          </section>
          <section className="panel cash-action-card">
            <div className="cash-action-icon close">
              <LockKeyhole size={20} />
            </div>
            <h3>Fechar caixa</h3>
            <p>
              Conte o dinheiro e confira a diferença antes de encerrar o turno.
            </p>
            <button
              className="secondary-button"
              onClick={() => setMode("close")}
            >
              Iniciar conferência
            </button>
          </section>
        </div>
      )}
      {register.status === "open" && mode === "movement" && (
        <CashMovementForm
          registerId={register.id}
          pending={isPending}
          onSubmit={event => submit(event, recordCashMovement)}
          onCancel={() => setMode("open")}
        />
      )}
      {register.status === "open" && mode === "close" && (
        <CashCloseForm
          registerId={register.id}
          expected={expected}
          pending={isPending}
          onSubmit={event => submit(event, closeCashRegister)}
          onCancel={() => setMode("open")}
        />
      )}
      <section className="panel cash-history">
        <div className="panel-heading">
          <div>
            <h3>
              Histórico do caixa <small>{movements.length}</small>
            </h3>
            <p>Movimentos registrados neste turno.</p>
          </div>
          <History size={18} />
        </div>
        {movements.length === 0 ? (
          <p className="catalog-empty">Nenhum movimento registrado.</p>
        ) : (
          <div className="cash-history-list">
            {movements.map(movement => (
              <div className="cash-movement-row" key={movement.id}>
                <span
                  className={`cash-movement-icon ${movement.amount_cents >= 0 ? "in" : "out"}`}
                >
                  {movement.amount_cents >= 0 ? (
                    <ArrowUpFromLine size={15} />
                  ) : (
                    <ArrowDownToLine size={15} />
                  )}
                </span>
                <span>
                  <strong>{cashMovementLabels[movement.movement_type]}</strong>
                  <small>
                    {dateTime(movement.created_at)} ·{" "}
                    {movement.description ?? "Sem descrição"}
                  </small>
                </span>
                <b
                  className={
                    movement.amount_cents >= 0
                      ? "cash-positive"
                      : "cash-negative"
                  }
                >
                  {movement.amount_cents >= 0 ? "+" : ""}
                  {money(movement.amount_cents)}
                </b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Notice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return notice ? (
    <div className={`catalog-notice ${notice.kind}`} role="status">
      {notice.kind === "success" ? <Check size={16} /> : <X size={16} />}
      <span>{notice.text}</span>
      <button onClick={onClose} aria-label="Fechar aviso">
        <X size={15} />
      </button>
    </div>
  ) : null;
}
function CashMovementForm({
  registerId,
  pending,
  onSubmit,
  onCancel,
}: {
  registerId: string;
  pending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel cash-inline-form">
      <div className="panel-heading">
        <div>
          <h3>Novo movimento</h3>
          <p>Entradas somam; saídas reduzem o saldo.</p>
        </div>
      </div>
      <form className="cash-form" onSubmit={onSubmit}>
        <input type="hidden" name="registerId" value={registerId} />
        <label>
          Tipo
          <select name="type" defaultValue="cash_in">
            <option value="cash_in">Entrada de dinheiro</option>
            <option value="cash_out">Saída de dinheiro</option>
          </select>
        </label>
        <label>
          Valor
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </label>
        <label>
          Descrição
          <input name="description" placeholder="Ex.: suprimento ou sangria" />
        </label>
        <div className="cash-form-buttons">
          <button className="primary-button" disabled={pending}>
            {pending ? "Registrando…" : "Registrar"}
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
function CashCloseForm({
  registerId,
  expected,
  pending,
  onSubmit,
  onCancel,
}: {
  registerId: string;
  expected: number;
  pending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel cash-inline-form close-form">
      <div className="panel-heading">
        <div>
          <h3>Conferência e fechamento</h3>
          <p>
            Conte o valor físico e compare com o esperado de {money(expected)}.
          </p>
        </div>
      </div>
      <form className="cash-form" onSubmit={onSubmit}>
        <input type="hidden" name="registerId" value={registerId} />
        <label>
          Valor contado
          <input
            name="counted"
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            required
          />
        </label>
        <label>
          Observação do fechamento
          <textarea
            name="notes"
            rows={2}
            placeholder="Ex.: conferência concluída…"
          />
        </label>
        <div className="cash-form-buttons">
          <button className="primary-button" disabled={pending}>
            {pending ? (
              "Fechando…"
            ) : (
              <>
                Confirmar fechamento <LockKeyhole size={15} />
              </>
            )}
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
