"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Email = {
  id: number;
  gmailMessageId: string;
  receivedAt: string;
  subject: string | null;
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

function getQaValue(qaData: { q: string; a: string }[] | null, ...keys: string[]): string {
  if (!qaData) return "";
  for (const key of keys) {
    const item = qaData.find((qa) => qa.q.includes(key));
    if (item) return item.a;
  }
  return "";
}

export default function InterviewPrepPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortBy, setSortBy] = useState("appointmentDatetime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [company, setCompany] = useState("");
  const [appointmentFrom, setAppointmentFrom] = useState("");
  const [appointmentTo, setAppointmentTo] = useState("");

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      sortBy,
      sortOrder,
      subjectContains: "\u53d6\u6750\u524d",
    });
    if (company) params.set("company", company);
    if (appointmentFrom) params.set("appointmentFrom", appointmentFrom);
    if (appointmentTo) params.set("appointmentTo", appointmentTo);

    const res = await fetch(`/api/emails?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [page, perPage, sortBy, sortOrder, company, appointmentFrom, appointmentTo]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
    if (status === "authenticated") {
      fetchEmails();
    }
  }, [status, fetchEmails, router]);

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
      {sortBy === field ? (sortOrder === "asc" ? "\u25b2" : "\u25bc") : "\u21c5"}
    </span>
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">取材前 一覧</h1>
            <Link
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              &#8592; ダッシュボードに戻る
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 py-3 w-full flex-shrink-0">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-wrap gap-3 items-end">
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
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">予定日時開始</label>
              <input
                type="date"
                value={appointmentFrom}
                onChange={(e) => { setAppointmentFrom(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs text-gray-500 mb-1">予定日時終了</label>
              <input
                type="date"
                value={appointmentTo}
                onChange={(e) => { setAppointmentTo(e.target.value); setPage(1); }}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setCompany(""); setAppointmentFrom(""); setAppointmentTo(""); setPage(1); }}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 pb-4 w-full flex-1 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col h-full">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="text-sm" style={{ minWidth: "1600px", width: "100%" }}>
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
                  <th className="px-2 py-2 text-left whitespace-nowrap">課題・興味</th>
                  <th className="px-2 py-2 text-left whitespace-nowrap">備考</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : emails.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                      「取材前」のメールはありません
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id} className="border-b hover:bg-orange-50">
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
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(email.appointmentDatetime)}</td>
                      <td className="px-2 py-2 text-xs">{email.assignedUser}</td>
                      <td className="px-2 py-2 text-xs">{email.registrant || ""}</td>
                      <td className="px-2 py-2 text-xs">{email.emailAddress || ""}</td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">{email.phoneNumber || ""}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "先方参加者", "参加予定", "役職", "氏名")}</td>
                      <td className="px-2 py-2 text-xs">{getQaValue(email.qaData, "課題感", "興味")}</td>
                      <td className="px-2 py-2 text-xs">{email.note || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
