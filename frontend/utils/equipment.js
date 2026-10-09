const ALIASES = new Map([
    ['网络接口/Wi-Fi', 'Wi-Fi'],
    ['网络接口/WIFI', 'Wi-Fi'],
    ['网络接口/WiFi', 'Wi-Fi'],
    ['WiFi', 'Wi-Fi'],
    ['WIFI', 'Wi-Fi']
]);

const REMOVED = new Set(['视频会议设备', '饮水设备']);

function normalizeEquipmentName(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (!trimmed) return '';
    const alias = ALIASES.get(trimmed) || trimmed;
    if (REMOVED.has(alias)) return '';
    return alias;
}

function normalizeEquipmentList(list) {
    if (typeof list === 'string') {
        const normalized = normalizeEquipmentName(list);
        return normalized ? [normalized] : [];
    }
    if (!Array.isArray(list)) return [];
    const output = [];
    const seen = new Set();
    list.forEach((item) => {
        const normalized = normalizeEquipmentName(item);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        output.push(normalized);
    });
    return output;
}

module.exports = {
    normalizeEquipmentName,
    normalizeEquipmentList
};
