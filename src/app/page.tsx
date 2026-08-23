"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { createClient } from "@/lib/supabase/client";
import { decryptEvent, encryptEvent } from "@/lib/crypto";
import type { Calendar, EncryptedEvent, Membership } from "@/types/database";

type EventDraft = { start: string; end: string; allDay: boolean } | null;

function Auth({ onReady }: { onReady: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const supabase = useMemo(createClient, []);

  async function submit(event: FormEvent, mode: "signin" | "signup") {
    event.preventDefault();
    setMessage("");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup")
      setMessage("가입 확인 이메일을 확인한 뒤 로그인하세요.");
    else onReady();
  }

  return (
    <main className="shell" style={{ maxWidth: 440, paddingTop: 90 }}>
      <section className="panel">
        <h1>함께 캘린더</h1>
        <p className="hint">조합별로 만들고 공유하는 암호화 단체 캘린더</p>
        <form className="form" onSubmit={(e) => submit(e, "signin")}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button>로그인</button>
          <button
            type="button"
            className="secondary"
            onClick={(e) => submit(e as unknown as FormEvent, "signup")}
          >
            새 계정 만들기
          </button>
          {message && <p className="hint">{message}</p>}
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const supabase = useMemo(createClient, []);
  const [ready, setReady] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selected, setSelected] = useState<Calendar | null>(null);
  const [events, setEvents] = useState<EncryptedEvent[]>([]);
  const [eventView, setEventView] = useState<
    {
      id: string;
      title: string;
      start: string;
      end: string;
      allDay: boolean;
    }[]
  >([]);
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f46e5");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, [supabase]);
  useEffect(() => {
    if (ready) loadCalendars();
  }, [ready]);

  async function loadCalendars() {
    const { data, error } = await supabase
      .from("calendar_members")
      .select("calendars(id,name,color,created_by,created_at)");
    if (error) return setError(error.message);
    const list = (data ?? [])
      .map((x: any) => x.calendars)
      .filter(Boolean) as Calendar[];
    setCalendars(list);
    if (!selected && list[0]) setSelected(list[0]);
  }

  async function loadEvents(calendarId: string, passphrase: string) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("calendar_id", calendarId)
      .order("starts_at");
    if (error) return setError(error.message);
    setEvents((data ?? []) as EncryptedEvent[]);
    try {
      setEventView(
        await Promise.all(
          (data ?? []).map(async (item: EncryptedEvent) => {
            const decoded = JSON.parse(
              await decryptEvent(item.encrypted_payload, passphrase),
            );
            return {
              id: item.id,
              title: decoded.title,
              start: item.starts_at,
              end: item.ends_at,
              allDay: item.all_day,
            };
          }),
        ),
      );
      setKey(passphrase);
      setError("");
    } catch {
      setEventView([]);
      setError(
        "암호키가 올바르지 않습니다. 캘린더를 만든 사람에게 암호키를 확인하세요.",
      );
    }
  }

  function chooseCalendar(calendar: Calendar) {
    setSelected(calendar);
    setKey("");
    setKeyInput("");
    setEventView([]);
  }

  async function createCalendar(event: FormEvent) {
    event.preventDefault();
    if (!newPassphrase) return setError("암호키를 입력하세요.");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase
      .from("calendars")
      .insert({
        name: newName,
        color: newColor,
        created_by: user.user.id,
      })
      .select()
      .single();
    if (error) return setError(error.message);
    setCalendars((x) => [...x, data]);
    setSelected(data);
    setKey(newPassphrase);
    setCreateOpen(false);
    setNewName("");
    setNewPassphrase("");
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    if (!selected || !draft || !key) return;
    const encrypted_payload = await encryptEvent(
      JSON.stringify({ title, note }),
      key,
    );
    const { error } = await supabase.from("events").insert({
      calendar_id: selected.id,
      encrypted_payload,
      starts_at: draft.start,
      ends_at: draft.end,
      all_day: draft.allDay,
    });
    if (error) return setError(error.message);
    setDraft(null);
    setTitle("");
    setNote("");
    await loadEvents(selected.id, key);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const { error } = await supabase.rpc("invite_calendar_member", {
      target_calendar: selected.id,
      target_email: email,
      member_role: role,
    });
    setError(error ? error.message : "구성원을 추가했습니다.");
    if (!error) setEmail("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setReady(false);
    setCalendars([]);
  }

  if (!ready) return <Auth onReady={() => setReady(true)} />;
  const selectedEvents = key ? eventView : [];
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>함께 캘린더</h1>
          <p>필요한 조합만 골라 공유하세요.</p>
        </div>
        <button className="secondary" onClick={signOut}>
          로그아웃
        </button>
      </header>
      <div className="layout">
        <aside className="panel">
          <h2>내 캘린더</h2>
          <div className="calendar-list">
            {calendars.map((c) => (
              <button
                key={c.id}
                className={`calendar-item ${selected?.id === c.id ? "active" : ""}`}
                onClick={() => chooseCalendar(c)}
              >
                <span className="dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
          <button
            style={{ marginTop: 14, width: "100%" }}
            onClick={() => setCreateOpen(true)}
          >
            + 새 캘린더
          </button>
          {selected && (
            <>
              <hr
                style={{
                  border: 0,
                  borderTop: "1px solid var(--line)",
                  margin: "22px 0",
                }}
              />
              <h2>구성원 초대</h2>
              <form className="form" onSubmit={invite}>
                <input
                  type="email"
                  placeholder="초대할 이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="editor">편집 가능</option>
                  <option value="viewer">보기만 가능</option>
                </select>
                <button>추가</button>
              </form>
              <p className="hint">
                일정 내용을 보려면 암호키도 별도로 안전하게 공유해야 합니다.
              </p>
            </>
          )}
        </aside>
        <section className="panel calendar-wrap">
          {!selected ? (
            <p className="empty">새 캘린더를 만들어 시작하세요.</p>
          ) : !key ? (
            <div style={{ maxWidth: 440, margin: "40px auto" }}>
              <h2>{selected.name} 열기</h2>
              <p className="hint">
                이 키는 브라우저에 저장되지 않으며 Supabase로 전송되지 않습니다.
              </p>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadEvents(selected.id, keyInput);
                }}
              >
                <input
                  type="password"
                  placeholder="캘린더 암호키"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  required
                />
                <button>암호화된 일정 열기</button>
              </form>
            </div>
          ) : (
            <>
              <div
                className="row"
                style={{ justifyContent: "space-between", marginBottom: 14 }}
              >
                <h2>{selected.name}</h2>
                <button
                  className="secondary"
                  onClick={() => {
                    setKey("");
                    setEventView([]);
                  }}
                >
                  잠그기
                </button>
              </div>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek",
                }}
                locale="ko"
                height="auto"
                events={selectedEvents}
                dateClick={(arg: DateClickArg) =>
                  setDraft({
                    start: arg.dateStr,
                    end: arg.dateStr,
                    allDay: arg.allDay,
                  })
                }
              />
            </>
          )}
        </section>
      </div>
      {error && (
        <p
          style={{
            color: "#b42318",
            position: "fixed",
            bottom: 10,
            left: 20,
            background: "white",
            padding: 10,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}
      {createOpen && (
        <div className="modal-backdrop">
          <form className="modal form" onSubmit={createCalendar}>
            <h2>새 캘린더 만들기</h2>
            <label>
              이름
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: A · B 일정"
                required
              />
            </label>
            <label>
              색상
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
              />
            </label>
            <label>
              암호키
              <input
                type="password"
                minLength={12}
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                required
              />
            </label>
            <p className="hint">
              12자 이상의 강한 키를 사용하세요. 분실 시 일정 내용을 복구할 수
              없습니다.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setCreateOpen(false)}
              >
                취소
              </button>
              <button>만들기</button>
            </div>
          </form>
        </div>
      )}
      {draft && (
        <div className="modal-backdrop">
          <form className="modal form" onSubmit={addEvent}>
            <h2>일정 등록</h2>
            <label>
              제목
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              메모
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <p className="hint">제목과 메모는 이 브라우저에서 암호화됩니다.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft(null)}
              >
                취소
              </button>
              <button>저장</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
