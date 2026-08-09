import * as https from "node:https";
import * as tls from "node:tls";
import { CACHE_TTL, getOrSetCache } from "./cache";

/**
 * 主計總處「人力資源調查失業率」XML（政府資料開放平台 dataset 6637，官方提供）。
 * 已實測確認可直接下載，免金鑰，UTF-8 編碼，每月更新，資料回溯至 1978 年。
 */
const DGBAS_UNEMPLOYMENT_XML_URL =
  "https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/230038/mp0101a07.xml";

/**
 * ws.dgbas.gov.tw 的 TLS 憑證鏈不完整：伺服器只送出網站憑證本身，沒有一併送出簽發者
 * 「TWCA Secure SSL Certification Authority」中繼憑證（已用 openssl s_client 實測確認）。
 * Windows 內建的憑證驗證（curl 用的 schannel）會自動用憑證裡的 AIA 網址去補抓遺漏的
 * 中繼憑證，但 Node 的 TLS 實作不會，因此全域 fetch() 對這個網域會直接拋出
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE，在 Vercel 的 serverless 環境會遇到一樣的問題。
 *
 * 這裡手動附上該中繼憑證（下載自 AIA 網址 http://sslserver.twca.com.tw/cacert/
 * secure_sha2_2023G3.crt，屬於官方 TWCA 憑證，只補完鏈、不是關閉驗證）讓 Node 能
 * 正確驗證到根憑證。用 tls.rootCertificates 展開是因為 https.Agent 的 ca 選項會
 * 「取代」而非「疊加」預設信任清單，不手動帶入內建根憑證會反而讓其他網站的驗證失敗。
 *
 * 另外 Node 全域 fetch()（undici）不吃 https.Agent 的自訂 ca，實測確認要改用
 * node:https 模組發送請求才會套用這個 agent。
 */
const TWCA_SECURE_SSL_INTERMEDIATE_CERT = `-----BEGIN CERTIFICATE-----
MIIFxjCCA66gAwIBAgIQQAE0s2gAAAAAAAAM0KoI7DANBgkqhkiG9w0BAQsFADBR
MQswCQYDVQQGEwJUVzESMBAGA1UEChMJVEFJV0FOLUNBMRAwDgYDVQQLEwdSb290
IENBMRwwGgYDVQQDExNUV0NBIEdsb2JhbCBSb290IENBMB4XDTIzMTAxNjA5MDEw
NFoXDTMwMTAxNjE1NTk1OVowUzELMAkGA1UEBhMCVFcxEjAQBgNVBAoTCVRBSVdB
Ti1DQTEwMC4GA1UEAxMnVFdDQSBTZWN1cmUgU1NMIENlcnRpZmljYXRpb24gQXV0
aG9yaXR5MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyS5amjYQhd10
hZs00r7RXdI3ASka2AQmJnOyA6bqvAYOMlMECUdlsjDccdmMdHx8YTYYMtmCy+UB
RJZ/ytVANVQlfcUvXzWfauFs8XpCC/Th+Ed2tIEEGK218QsBebImAHPGDvp2Yglj
XVaQR/0FeN1lIzQ3iUkad0dCsC/bxFiWsmsjeSscTaxrYzHFADUhK0qj4W5PmOuw
lAR3C4XXgzPAI3V0qBpQ7sqgNLaNBFTZkP6AVryZC+DapfWBIMmIxIOg8g25MKb4
XvXkCLYKIxi8Djhv1zSmLLrKbQFZrjWlD/OWqInPPmSwBrKZ13EMQhoRRi1pXfN+
J2ugR/PUQQIDAQABo4IBljCCAZIwHwYDVR0jBBgwFoAUSNvN3o7pSXJaiOix2D0H
s7lrZlAwHQYDVR0OBBYEFJLn+mIWcYzzl3FCxgan4EZhS1y2MA4GA1UdDwEB/wQE
AwIBhjAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwSgYDVR0gBEMwQTA1
BgsrBgEEAYK/JQEBFTAmMCQGCCsGAQUFBwIBFhhodHRwczovL3d3dy50d2NhLmNv
bS50dy8wCAYGZ4EMAQICMEkGA1UdHwRCMEAwPqA8oDqGOGh0dHA6Ly9yb290Y2Eu
dHdjYS5jb20udHcvVFdDQVJDQS9nbG9iYWxfcmV2b2tlXzQwOTYuY3JsMBIGA1Ud
EwEB/wQIMAYBAf8CAQAwdgYIKwYBBQUHAQEEajBoMDwGCCsGAQUFBzAChjBodHRw
Oi8vc3Nsc2VydmVyLnR3Y2EuY29tLnR3L2NhY2VydC9yb290NDA5Ni5jcnQwKAYI
KwYBBQUHMAGGHGh0dHA6Ly9yb290b2NzcC50d2NhLmNvbS50dy8wDQYJKoZIhvcN
AQELBQADggIBADVzQW2rRsMiWoVrBdZX1BiOgN6B/Ryt2zpq8uRxFQspvGYfUVIm
4uU4AaPR7aQ5KwpKjDWv2ncvX2ssCY54B82g2mxEEVEdu5PFl0jkuk4LmPsClYZc
6J6odUbVI3wtv2yF6+fqQrO+gDhEIhlg3IqWICfiyJZS+p2TirMszGzs4a+K9tZX
rS2W/jKsSt4bSmcIzDpwm2gSaSuLDIAwq0WrD29kA7+N+rMMs4zBIVKyYm9r08q4
UOGU16J7mKBrF0KYDZFyT9Hq5HAX2uwYoQJxQ5Z0BR8eZH8AIIi2vsFC8pkv2ra1
2dldd3Pivm0mdratbn1Z6MQ71FKR9Ui3L8P+0xu8DkhhxE11Ogpl+aquBUqGcvlD
0SgpXy+eoeFaRhFXRUkWtH/3XYo+h+N+4jZmgjCLd4+YI+u5tbUGpyBMABmUDiqZ
xcrPGc4cvXExqYePUg6cFCDcjqGCxqSu5BPbA5R+DSTkn5Sc1WQzORJpD5b7pcEq
8msolev88dcmddLXMyWzXQfPHA4vaQD74lr5LIzn6BRjVv+ZB7Y0ZTnnOimDXxn7
Cxqd+1/8ldRis/tO/JWZsMm5ruvCppwCZUdXjSNI5R1OxzVwTVLzsCoiSYPV0agd
a5dQ9wayB6OohBK7+ZU2V3sZwE2xwHdDzfhbdzmI++TxtOurDHbkfkED
-----END CERTIFICATE-----`;

const dgbasAgent = new https.Agent({
  ca: [...tls.rootCertificates, TWCA_SECURE_SSL_INTERMEDIATE_CERT],
});

/** 用 node:https 發 GET 請求並回傳整個回應內容；非 2xx 或逾時都視為失敗直接 reject */
function httpsGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { agent: dgbasAgent }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(10_000, () => request.destroy(new Error("request timeout")));
  });
}

/**
 * 取得全國失業率最新一筆月資料（「總計_Total_百分比」欄位）。
 *
 * 資料本身是官方公開的簡單重複區塊 XML，欄位固定、格式穩定多年，這裡用正規表示式
 * 抓最後一個 <失業率>...</失業率> 區塊裡的年月與總計欄位，避免為了這一個資料源
 * 額外引入完整的 XML parser 套件。若未來欄位格式改變導致抓不到值，會回傳
 * { value: null, date: null }，不會噴例外，呼叫端一樣會走既有的缺失值代入機制。
 */
export async function fetchUnemploymentRate(): Promise<{
  value: number | null;
  date: string | null;
}> {
  return getOrSetCache("dgbas:unemploymentRate", CACHE_TTL.macro, async () => {
    try {
      const xml = await httpsGetText(DGBAS_UNEMPLOYMENT_XML_URL);
      const blocks = xml.match(/<失業率>[\s\S]*?<\/失業率>/g);
      const lastBlock = blocks?.[blocks.length - 1];
      if (!lastBlock) return { value: null, date: null };

      const yearMonthMatch = lastBlock.match(
        /<年月別_Year_and_month>([^<]+)<\/年月別_Year_and_month>/
      );
      const totalMatch = lastBlock.match(
        /<總計_Total_百分比>([^<]+)<\/總計_Total_百分比>/
      );
      if (!yearMonthMatch || !totalMatch) return { value: null, date: null };

      const value = Number(totalMatch[1]);
      if (!Number.isFinite(value)) return { value: null, date: null };

      // 原始格式為 "2026M06"，轉成 YYYY-MM-01（月資料沒有實際「日」，固定用 01）
      const yearMonth = yearMonthMatch[1].match(/^(\d{4})M(\d{2})$/);
      const date = yearMonth ? `${yearMonth[1]}-${yearMonth[2]}-01` : null;

      return { value, date };
    } catch {
      return { value: null, date: null };
    }
  });
}
