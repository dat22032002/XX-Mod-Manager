// Đoán nhân vật của mod mới từ TÊN thư mục mod + TÊN file bên trong
// (Đạt dặn 22/11). Chỉ đọc TÊN, không đọc nội dung file.ini/metadata.
// Chỉ đoán được nhân vật ĐÃ CÓ ít nhất 1 mod trong kho (danh sách
// "đã biết" lấy từ nhân vật của các mod đang có — app không có danh
// sách nhân vật chuẩn nào khác).

// Tách 1 chuỗi thành token: theo ký tự không phải chữ/số + ranh giới
// camelCase + ranh giới chữ/số. Vd: "Ellen-Joe_Dress2" ->
// ["ellen","joe","dress","2"]; "NicoleDemara" -> ["nicole","demara"].
export function tokenizeName(text: string): string[] {
    const withBoundaries = text
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([a-zA-Z])/g, '$1 $2');
    return withBoundaries.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Tên nhân vật khớp khi TOÀN BỘ token của tên nhân vật xuất hiện LIÊN
// TIẾP trong token của chuỗi cần đoán — tránh dương tính giả kiểu chuỗi
// con: "anbydemara" là 1 token nên KHÔNG khớp Anby.
function nameMatches(characterTokens: string[], haystackTokens: string[]): boolean {
    if (characterTokens.length === 0) return false;
    outer: for (let i = 0; i + characterTokens.length <= haystackTokens.length; i++) {
        for (let j = 0; j < characterTokens.length; j++) {
            if (haystackTokens[i + j] !== characterTokens[j]) continue outer;
        }
        return true;
    }
    return false;
}

// Đoán nhân vật: ưu tiên tên thư mục mod, rồi tới tên file bên trong.
// Đúng 1 nhân vật thì đoán, 0 hoặc nhiều thì để trống (không đoán bừa).
// fileNames: tên file (không đường dẫn), phía gọi cắt sẵn tối đa ~500 file.
export function guessCharacterFromNames(
    folderName: string,
    fileNames: string[],
    knownCharacters: string[],
): string | null {
    // Loại 'Unknown' khỏi đối chiếu — nó không phải tên nhân vật thật.
    const candidates = knownCharacters.filter((c) => c && c !== 'Unknown');
    // 1. Tên thư mục mod.
    const folderTokens = tokenizeName(folderName);
    const folderMatched = candidates.filter((c) => nameMatches(tokenizeName(c), folderTokens));
    if (folderMatched.length === 1) return folderMatched[0];
    if (folderMatched.length > 1) return null;
    // 2. Tên file bên trong: khớp từng file riêng (không nối token qua
    // 2 file khác nhau), gom tập nhân vật khớp được.
    const fileMatched = new Set<string>();
    for (const fileName of fileNames) {
        const tokens = tokenizeName(fileName);
        for (const c of candidates) {
            if (nameMatches(tokenizeName(c), tokens)) fileMatched.add(c);
        }
    }
    if (fileMatched.size === 1) return [...fileMatched][0];
    return null;
}
