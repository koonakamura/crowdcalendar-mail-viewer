"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type Email = {
  id: number;
  gmailMessageId: string;
  receivedAt: string;
  calendarType: string;
  companyName: string;
  registrant: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  appointmentDatetime: string;
  appointmentEnd: string | null;
  crowdCalendarUrl: string | null;
  assignedUser: string | null;
  note: string | null;
  qaData: { q: string; a: string }[] | null;
};

type FiltersData = {
  calendarTypes: string[];
  assignedUsers: string[];
  services: string[];
  departments: string[];
};

function getQaValue(qaData: { q: string; a: string }[] | null, ...keys: string[]): string {
  if (!qaData) return "";
  for (const key of keys) {
    const item = qaData.find((qa) => qa.q.includes(key));
    if (item) return item.a;
  }
  return "";
}

// 複数選択ドロップダウンコンポーネント
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border rounded px-2 py-1.5 text-sm text-left bg-white flex justify-between items-center"
      >
        <span className="truncate text-gray-700">
          {selected.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            selected.join(", ")
          )}
        </span>
        <span className="ml-1 text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 min-w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
          {options.length === 0 ? (
            <div className="px-2 py-2 text-sm text-gray-400">選択肢なし</div>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="mr-2"
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filtersData, setFiltersData] = useState<FiltersData>({
    calendarTypes: [],
    assignedUsers: [],
    services: [],
    departments: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortBy, setSortBy] = useState("receivedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 複数選択フィルター
  const [calendarTypes, setCalendarTypes] = useState<string[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // テキスト・日付フィルター
  const [company, setCompany] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [appointmentFrom, setAppointmentFrom] = useState("");
  const [appointmentTo, setAppointmentTo] = useState("");

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      sortBy,
      sortOrder,
    });
    if (calendarTypes.length > 0) params.set("calendarTypes", calendarTypes.join(","));
    if (company) params.set("company", company);
    if (assignedUsers.length > 0) params.set("assignedUsers", assignedUsers.join(","));
    if (receivedFrom) params.set("dateFrom", receivedFrom);
    if (receivedTo) params.set("dateTo", receivedTo);
    if (appointmentFrom) params.set("appointmentFrom", appointmentFrom);
    if (appointmentTo) params.set("appointmentTo", appointmentTo);
    if (services.length > 0) params.set("services", services.join(","));
    if (departments.length > 0) params.set("departments", departments.join(","));

    const res = await fetch(`/api/emails?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setFiltersData({
        calendarTypes: data.filters?.calendarTypes ?? [],
        assignedUsers: data.filters?.assignedUsers ?? [],
        services: data.filters?.services ?? [],
        departments: data.filters?.departments ?? [],
      });
    }
    setLoading(false);
  }, [page, perPage, sortBy, sortOrder, calendarTypes, company, assignedUsers, receivedFrom, receivedTo, appointmentFrom, appointmentTo, services, departments]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
    if (status === "authenticated") {
      fetchEmails();
    }
  }, [status, fetchEmails, router]);

  const handleSync = async (resync = false) => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const url = resync ? "/api/emails/sync?resync=true" : "/api/emails/sync";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message);
        fetchEmails();
      } else {
        setSyncMessage("エラー: " + data.error);
      }
    } catch {
      setSyncMessage("同期に失敗しました");
    }
    setSyncing(false);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (calendarTypes.length > 0) params.set("calendarTypes", calendarTypes.join(","));
    if (company) params.set("company", company);
    if (assignedUsers.length > 0) params.set("assignedUsers", assignedUsers.join(","));
    if (receivedFrom) params.set("dateFrom", receivedFrom);
    if (receivedTo) params.set("dateTo", receivedTo);
    if (appointmentFrom) params.set("appointmentFrom", appointmentFrom);
    if (appointmentTo) params.set("appointmentTo", appointmentTo);
    if (services.length > 0) params.set("services", services.join(","));
    if (departments.length > 0) params.set("departments", departments.join(","));
    window.location.href = `/api/emails/export?${params}`;
  };

  const handleReset = () => {
    setCalendarTypes([]);
    setCompany("");
    setAssignedUsers([]);
    setReceivedFrom("");
    setReceivedTo("");
    setAppointmentFrom("");
    setAppointmentTo("");
    setServices([]);
    setDepartments([]);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-xs">
      {sortBy === field ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  const COL_COUNT = 16;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ヘッダー固定 */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">CrowdCalendar Mail Viewer</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <button
              onClick={() => handleSync(false)}
              disabled={syncing}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? "同期中..." : "同期"}
            </button>
            <button
              onClick={() => { if (confirm("全データを削除して再取得します。よろしいですか？")) handleSync(true); }}
              disabled={syncing}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
            >
              再同期
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              CSV DL
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* 同期メッセージ固定 */}
      {syncMessage && (
        <div className="max-w-full mx-auto px-4 py-2 w-full flex-shrink-0">
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">
            {syncMessage}
          </div>
        </div>
      )}

      {/* フィルター固定 */}
      <div className="max-w-full mx-auto px-4 py-3 w-full flex-shrink-0">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* カレンダー種別（複数選択） */}
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">カレンダー種別</label>
              <MultiSelect
                options={filtersData.calendarTypes}
                selected={calendarTypes}
                onChange={(v) => { setCalendarTypes(v); setPage(1); }}
                placeholder="すべて"
              />
            </div>

            {/* 会社名 */}
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">会社名</label>
              <input
                type="text"
                value={company}
                onChange={(e) => { setCompany(e.target.value); setPage(1); }}
                placeholder="検索..."
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {/* 予定追加ユーザー（複数選択） */}
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">予定追加ユーザー</label>
              <MultiSelect
                options={filtersData.assignedUsers}
                selected={assignedUsers}
                onChange={(v) => { setAssignedUsers(v); setPage(1); }}
                placeholder="すべて"
              />
            </div>

            {/* 受信期間開始 */}
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">受信期間開始</label>
              <input
                type="date"
                value={receivedFrom}
                onChange={(e) => { setReceivedFrom(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {/* 受信期間終了 */}
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">受信期間終了</label>
              <input
                type="date"
                value={receivedTo}
                onChange={(e) => { setReceivedTo(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {/* 予定日時開始 */}
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">予定日時開始</label>
              <input
                type="date"
                value={appointmentFrom}
                onChange={(e) => { setAppointmentFrom(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {/* 予定日時終了 */}
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">予定日時終了</label>
              <input
                type="date"
                value={appointmentTo}
                onChange={(e) => { setAppointmentTo(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            {/* 支援中のサービス（複数選択） */}
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">支援中のサービス</label>
              <MultiSelect
                options={filtersData.services}
                selected={services}
                onChange={(v) => { setServices(v); setPage(1); }}
                placeholder="すべて"
              />
            </div>

            {/* 提案取得者所属（複数選択） */}
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">提案取得者所属</label>
              <MultiSelect
                options={filtersData.departments}
                selected={departments}
                onChange={(v) => { setDepartments(v); setPage(1); }}
                placeholder="すべて"
              />
            </div>

            {/* リセット */}
            <div className="flex items-end">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 whitespace-nowrap"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* テーブルエリア */}
      <div className="max-w-full mx-auto px-4 pb-4 w-full flex-1 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col h-full">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="text-sm" style={{ minWidth: "2200px", width: "100%" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b">
                  <th className="px-2 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort("receivedAt")}>
                    受信日時<SortIcon field="receivedAt" />
                  </th>
                  <th className="px-2 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort("calendarType")}>
                    カレンダー種別<SortIcon field="calendarType" />
                  </th>
                  <th className="px-2 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort("companyName")}>
                    会社名<SortIcon field="companyName" />
                  </th>
                  <th className="px-2 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort("appointmentDatetime")}>
                    予定日時<SortIcon field="appointmentDatetime" />
                  </th>
                  <th className="px-2 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-100" onClick={() => handleSort("assignedUser")}>
                    予定追加ユーザー<SortIcon field="assignedUser" />
                  </th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">登録者</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">メールアドレス</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">電話番号</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">先方参加者</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">支援中のサービス</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">取得者</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">QAメールアドレス</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">提案取得者所属</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">先方連絡先</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">課題・興味</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">その他</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-3 py-8 text-center text-gray-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : emails.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-3 py-8 text-center text-gray-500">
                      データがありません。「同期」ボタンでメールを取得してください。
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id} className="border-b hover:bg-blue-50">
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(email.receivedAt)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{email.calendarType}</td>
                      <td className="px-2 py-2 font-medium">
                        {email.crowdCalendarUrl ? (
                          <a href={email.crowdCalendarUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {email.companyName}
                          </a>
                        ) : (
                          email.companyName
                        )}
                      </td>
                      {/* 変更7: 終了時刻を削除 */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDate(email.appointmentDatetime)}
                      </td>
                      <td className="px-2 py-2 text-xs">{email.assignedUser}</td>
                      <td className="px-2 py-2 text-xs">{email.registrant || ""}</td>
                      <td className="px-2 py-2 text-xs">{email.emailAddress || ""}</td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">{email.phoneNumber || ""}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "先方参加者", "参加予定", "役職", "氏名")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "支援中のサービス", "現在提供している支援サービス")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "取得者", "面談調整")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "メールアドレスを教えて", "メールアドレス")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "提案取得者所属")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "先方連絡先", "ご連絡先")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "課題感", "興味")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "その他", "ご要望")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>全{totalCount}件</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(parseInt(e.target.value)); setPage(1); }}
                className="border rounded px-2 py-1"
              >
                <option value="100">100件</option>
                <option value="200">200件</option>
                <option value="500">500件</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages || 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}