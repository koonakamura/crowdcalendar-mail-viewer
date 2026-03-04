"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
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
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filtersData, setFiltersData] = useState<FiltersData>({
    calendarTypes: [],
    assignedUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortBy, setSortBy] = useState("receivedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [calendarType, setCalendarType] = useState("");
  const [company, setCompany] = useState("");
  const [assignedUser, setAssignedUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(), perPage: perPage.toString(), sortBy, sortOrder,
    });
    if (calendarType) params.set("calendarType", calendarType);
    if (company) params.set("company", company);
    if (assignedUser) params.set("assignedUser", assignedUser);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/emails?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setFiltersData(data.filters);
    }
    setLoading(false);
  }, [page, perPage, sortBy, sortOrder, calendarType, company, assignedUser, dateFrom, dateTo]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchEmails();
  }, [status, fetchEmails, router]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/emails/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) { setSyncMessage(data.message); fetchEmails(); }
      else { setSyncMessage("エラー: " + data.error); }
    } catch { setSyncMessage("同期に失敗しました"); }
    setSyncing(false);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (calendarType) params.set("calendarType", calendarType);
    if (company) params.set("company", company);
    if (assignedUser) params.set("assignedUser", assignedUser);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.location.href = `/api/emails/export?${params}`;
  };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortOrder("desc"); }
    setPage(1);
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); return; }
    setExpandedId(id);
    const res = await fetch(`/api/emails/${id}`);
    if (res.ok) setExpandedDetail(await res.json());
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
    return <div className="min-h-screen flex items-center justify-center"><p>読み込み中...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">CrowdCalendar Mail Viewer</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {syncing ? "同期中..." : "同期"}
            </button>
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
              CSV DL
            </button>
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {syncMessage && (
        <div className="max-w-full mx-auto px-4 py-2">
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">{syncMessage}</div>
        </div>
      )}

      <div className="max-w-full mx-auto px-4 py-3">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">カレンダー種別</label>
              <select value={calendarType} onChange={(e) => { setCalendarType(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">すべて</option>
                {filtersData.calendarTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">会社名</label>
              <input type="text" value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }}
                placeholder="検索..." className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">予定追加ユーザー</label>
              <select value={assignedUser} onChange={(e) => { setAssignedUser(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">すべて</option>
                {filtersData.assignedUsers.map((u) => <option key={u} value={u!}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">期間（開始）</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">期間（終了）</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={() => { setCalendarType(""); setCompany(""); setAssignedUser(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                className="w-full px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                リセット
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 pb-4">
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("receivedAt")}>
                  受信日時<SortIcon field="receivedAt" />
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("calendarType")}>
                  カレンダー種別<SortIcon field="calendarType" />
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("companyName")}>
                  会社名<SortIcon field="companyName" />
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("appointmentDatetime")}>
                  予定日時<SortIcon field="appointmentDatetime" />
                </th>
                <th className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("assignedUser")}>
                  予定追加ユーザー<SortIcon field="assignedUser" />
                </th>
                <th className="px-3 py-2 text-left">URL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">読み込み中...</td></tr>
              ) : emails.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">データがありません。「同期」ボタンでメールを取得してください。</td></tr>
              ) : (
                emails.map((email) => (
                  <tbody key={email.id}>
                    <tr className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => toggleExpand(email.id)}>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(email.receivedAt)}</td>
                      <td className="px-3 py-2">{email.calendarType}</td>
                      <td className="px-3 py-2 font-medium">{email.companyName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(email.appointmentDatetime)}
                        {email.appointmentEnd && (
                          <span className="text-gray-400"> - {new Date(email.appointmentEnd).getHours()}:{String(new Date(email.appointmentEnd).getMinutes()).padStart(2, "0")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{email.assignedUser}</td>
                      <td className="px-3 py-2">
                        {email.crowdCalendarUrl && (
                          <a href={email.crowdCalendarUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>開く</a>
                        )}
                      </td>
                    </tr>
                    {expandedId === email.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50 border-b">
                          {expandedDetail ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div><span className="text-gray-500">登録者:</span><p>{expandedDetail.registrant || "-"}</p></div>
                              <div><span className="text-gray-500">メールアドレス:</span><p>{expandedDetail.emailAddress || "-"}</p></div>
                              <div><span className="text-gray-500">電話番号:</span><p>{expandedDetail.phoneNumber || "-"}</p></div>
                              <div><span className="text-gray-500">備考:</span><p>{expandedDetail.note || "-"}</p></div>
                              {expandedDetail.qaData && expandedDetail.qaData.length > 0 && (
                                <div className="col-span-full">
                                  <span className="text-gray-500">質問と回答:</span>
                                  <table className="mt-1 w-full border text-xs">
                                    <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left border-r">質問</th><th className="px-2 py-1 text-left">回答</th></tr></thead>
                                    <tbody>
                                      {expandedDetail.qaData.map((qa: { q: string; a: string }, i: number) => (
                                        <tr key={i} className="border-t">
                                          <td className="px-2 py-1 border-r">{qa.q}</td>
                                          <td className="px-2 py-1">{qa.a}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ) : (<p className="text-gray-500">読み込み中...</p>)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>全{totalCount}件</span>
              <select value={perPage} onChange={(e) => { setPerPage(parseInt(e.target.value)); setPage(1); }}
                className="border rounded px-2 py-1">
                <option value="100">100件</option>
                <option value="200">200件</option>
                <option value="500">500件</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50">前へ</button>
              <span className="text-sm text-gray-600">{page} / {totalPages || 1}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50">次へ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}