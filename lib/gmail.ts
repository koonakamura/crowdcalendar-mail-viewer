import { google } from "googleapis";
import { prisma } from "./prisma";

export function parseEmailBody(subject: string, body: string) {
  const subjectMatch = subject.match(/【(.+?)\s*様】(.+?)\s+\d{4}年/);
  const calendarType = subjectMatch ? subjectMatch[2].trim() : "";
  const subjectCompany = subjectMatch ? subjectMatch[1].trim() : "";

  const companyMatch = body.match(/○[ \t]*会社名:[ \t]*(.*)/);
  const registrantMatch = body.match(/○[ \t]*登録者:[ \t]*(.*)/);
  const emailMatch = body.match(/○[ \t]*メールアドレス:[ \t]*(.*)/);
  const phoneMatch = body.match(/○[ \t]*電話番号:[ \t]*(.*)/);
  const datetimeMatch = body.match(/○[ \t]*日時:[ \t]*(.*)/);
  const urlMatch = body.match(/○[ \t]*URL:[ \t]*(.*)/);
  const userMatch = body.match(/・[ \t]*(.+?（.+?）)/);
  const noteMatch = body.match(/○[ \t]*備考:[ \t]*(.*)/);

  let appointmentDatetime: Date | null = null;
  let appointmentEnd: Date | null = null;
  if (datetimeMatch) {
    const dtStr = datetimeMatch[1].trim();
    const dtMatch = dtStr.match(
      /(\d{4})年(\d{1,2})月(\d{1,2})日.+?\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/
    );
    if (dtMatch) {
      const [, year, month, day, startH, startM, endH, endM] = dtMatch;
      appointmentDatetime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(startH),
        parseInt(startM)
      );
      appointmentEnd = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(endH),
        parseInt(endM)
      );
    }
  }

  const qaData: { q: string; a: string }[] = [];
  const qaRegex = /◆(.+?)[\r\n]+⇒(.*)/g;
  let qaMatch;
  while ((qaMatch = qaRegex.exec(body)) !== null) {
    qaData.push({
      q: qaMatch[1].trim(),
      a: qaMatch[2].trim(),
    });
  }

  const trimOrNull = (val: string | undefined): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    calendarType,
    companyName: companyMatch ? companyMatch[1].trim() : subjectCompany,
    registrant: registrantMatch ? trimOrNull(registrantMatch[1]) : null,
    emailAddress: emailMatch ? trimOrNull(emailMatch[1]) : null,
    phoneNumber: phoneMatch ? trimOrNull(phoneMatch[1]) : null,
    appointmentDatetime,
    appointmentEnd,
    crowdCalendarUrl: urlMatch ? trimOrNull(urlMatch[1]) : null,
    assignedUser: userMatch ? userMatch[1].trim() : null,
    note: noteMatch ? trimOrNull(noteMatch[1]) : null,
    qaData: qaData.length > 0 ? qaData : null,
    rawBody: body,
  };
}

export async function syncEmails(accessToken: string, userEmail: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const query = "from:info@crowd-calendar.com after:2026/3/2";

  let allMessages: any[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
      pageToken,
    });
    if (res.data.messages) {
      allMessages = allMessages.concat(res.data.messages);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  let newCount = 0;

  for (const msg of allMessages) {
    const existing = await prisma.email.findUnique({
      where: { gmailMessageId: msg.id },
    });
    if (existing) continue;

    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = detail.data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
    const dateHeader = headers.find((h: any) => h.name === "Date")?.value || "";
    const receivedAt = new Date(dateHeader);

    let body = "";
    const payload = detail.data.payload;
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      } else {
        const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
        if (htmlPart?.body?.data) {
          body = Buffer.from(htmlPart.body.data, "base64")
            .toString("utf-8")
            .replace(/<[^>]*>/g, "\n")
            .replace(/\n{2,}/g, "\n");
        }
      }
    }

    const parsed = parseEmailBody(subject, body);

    if (parsed.appointmentDatetime) {
      await prisma.email.create({
        data: {
          gmailMessageId: msg.id,
          receivedAt,
          calendarType: parsed.calendarType,
          companyName: parsed.companyName,
          registrant: parsed.registrant,
          emailAddress: parsed.emailAddress,
          phoneNumber: parsed.phoneNumber,
          appointmentDatetime: parsed.appointmentDatetime,
          appointmentEnd: parsed.appointmentEnd,
          crowdCalendarUrl: parsed.crowdCalendarUrl,
          assignedUser: parsed.assignedUser,
          note: parsed.note,
          qaData: parsed.qaData || undefined,
          rawBody: parsed.rawBody,
        },
      });
      newCount++;
    }
  }

  await prisma.syncStatus.upsert({
    where: { userEmail },
    update: { lastSyncedAt: new Date() },
    create: { userEmail, lastSyncedAt: new Date() },
  });

  return { total: allMessages.length, newCount };
}