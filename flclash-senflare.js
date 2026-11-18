/**
 * FlClash / Mihomo 配置脚本
 * 移植源：Senflare Link Lite v4.6.5 主后端 _worker.js
 * 上游增强：可选链式代理（默认关闭）、中国移动 DM 遥测拦截
 * 链式代理用法：把 ENABLE_CHAIN 改为 true；在「链式前置」选入口节点，
 *              「链式出口」选落地节点，再把主策略组切到「链式出口」。
 * 覆写类型：JavaScript
 */
function main(config) {
  config = config || {};

  // ===== 规则集源（testingcf 是 jsDelivr 的 CF 加速域名，国内可直连）=====
  var MRS = 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/';
  var ADS = 'https://testingcf.jsdelivr.net/gh/DustinWin/ruleset_geodata@mihomo-ruleset/ads.mrs';
  var ICON = 'https://cdn.jsdmirror.com/gh/AIsouler/MyClash@main/Icons/svg/';

  // [RULE-SET 名, mrs 路径, 目标, 分段]
  var P = [
    ['geoip-private', 'geoip/private.mrs', 'DIRECT,no-resolve', 'private'],
    ['geosite-private', 'geosite/private.mrs', 'DIRECT', 'private'],
    ['ads', null, '广告拦截', 'ads'],
    ['geosite-category-ads-all', 'geosite/category-ads-all.mrs', '广告拦截', 'ads'],
    ['geosite-category-ai-!cn', 'geosite/category-ai-!cn.mrs', 'AI 助手', 'ai'],
    ['geosite-github', 'geosite/github.mrs', '节点选择', 'proxy'],
    ['geosite-google', 'geosite/google.mrs', '节点选择', 'proxy'],
    ['geosite-category-games@cn', 'geosite/category-games@cn.mrs', 'DIRECT', 'direct'],
    ['geosite-epicgames', 'geosite/epicgames.mrs', 'DIRECT', 'direct'],
    ['geosite-nvidia@cn', 'geosite/nvidia@cn.mrs', 'DIRECT', 'direct'],
    ['geosite-cn', 'geosite/cn.mrs', 'DIRECT', 'direct'],
    ['geoip-cn', 'geoip/cn.mrs', 'DIRECT', 'direct'],
    ['geosite-apple-cn', 'geosite/apple-cn.mrs', 'DIRECT', 'direct'],
    ['geosite-microsoft', 'geosite/microsoft.mrs', 'DIRECT', 'direct'],
    ['douyin', 'geosite/douyin.mrs', '', 'douyin'],
    ['geolocation-cn', 'geosite/geolocation-cn.mrs', '', 'geolocation-cn']
  ];

  var DIRECT_DOMAINS = ['senflarelink.de5.net'];
  var PROXY_DOMAINS = ['z.ai'];
  var AD_DOMAINS = ['miav-cse.avlyun.com', 'miui-fxcse.avlyun.com', 'a0.app.xiaomi.com', 'api.installer.xiaomi.com'];
  // v4.6.2 起新增：面板「拦截规则」（对应 UserRejectDomains）；留空即不启用
  var REJECT_DOMAINS = [];
  // v4.6.2 起新增：字节系功能性域名，先于广告规则放行，避免直播/音乐被误拦
  var BYTEDANCE_KEEP = [
    'live.douyin.com',
    'webcast.amemv.com',
    'webcast5-open-hl.douyin.com',
    'webcast5-ws-web-hl.douyin.com',
    'streamingtool-hl.douyin.com',
    'music.douyin.com',
    'douyinvod.com',
    'douyinpic.com',
    'douyinstatic.com'
  ];
  var FAKE_IP_FILTER = ['+.lan', '+.local', 'time.nist.gov', '+.pool.ntp.org', 'time.*.com', 'ntp.*.com', 'rule-set:geolocation-cn'];
  var DOH = ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'];
  var EXCLUDE = '^直连$|^拦截$|^DIRECT$|^REJECT$|剩余流量|套餐到期|距离下次|过期时间|官网|Expire|Traffic|重置';

  // ===== 上游 flclash.js 增强：可选链式代理 =====
  // 开启后每个节点会多一份「【落地】节点」，链路：设备 -> 链式前置 -> 链式出口 -> 网站。
  // 默认关闭，避免节点数量翻倍；需要时把 false 改成 true。
  var ENABLE_CHAIN = false;
  var CHAIN_ENTRY = '链式前置';
  var CHAIN_EXIT = '链式出口';
  var CHAIN_PREFIX = '【落地】';
  var CHAIN_EXCLUDE = '^' + CHAIN_PREFIX;
  var CHAIN_ENTRY_EXCLUDE = CHAIN_EXCLUDE + '|^' + CHAIN_ENTRY + '$|^' + CHAIN_EXIT + '$';

  // 上游 flclash.js 默认拦截的中国移动终端 DM 遥测域名；不需要可清空数组
  var TRACKER_DOMAINS = ['fxltsbl.com'];

  var i, seg, row, rules = [], providers = {};

  function segRules(s) {
    var out = [], k;
    for (k = 0; k < P.length; k++) if (P[k][3] === s) out.push('RULE-SET,' + P[k][0] + ',' + P[k][2]);
    return out;
  }

  // 链式代理：复制普通节点为「落地」节点，并补上链式前置/出口两张组。
  // 同时兼容 proxy-providers；已经应用过则直接返回，避免重复复制。
  function applyChainProxy(cfg) {
    var groups = cfg['proxy-groups'] || [], gi, key, node, clone;
    for (gi = 0; gi < groups.length; gi++) if (groups[gi].name === CHAIN_ENTRY) return cfg;

    var skip = new RegExp(EXCLUDE);
    var all = cfg.proxies || [], base = [], landing = [];
    for (gi = 0; gi < all.length; gi++) {
      node = all[gi] || {};
      if (String(node.name || '').indexOf(CHAIN_PREFIX) === 0) continue;
      base.push(node);
      if (skip.test(String(node.name || ''))) continue;
      clone = {};
      for (key in node) if (Object.prototype.hasOwnProperty.call(node, key)) clone[key] = node[key];
      clone.name = CHAIN_PREFIX + node.name;
      clone['dialer-proxy'] = CHAIN_ENTRY;
      landing.push(clone);
    }
    cfg.proxies = base.concat(landing);

    var providers = cfg['proxy-providers'] || {}, pname, provider, pclone, ov, ov2, exprs;
    for (pname in providers) {
      if (!Object.prototype.hasOwnProperty.call(providers, pname) || pname.indexOf('__chain_exit__') === 0) continue;
      provider = providers[pname] || {};
      pclone = {};
      for (key in provider) if (Object.prototype.hasOwnProperty.call(provider, key)) pclone[key] = provider[key];
      ov = provider.override || {};
      ov2 = {};
      for (key in ov) if (Object.prototype.hasOwnProperty.call(ov, key)) ov2[key] = ov[key];
      exprs = ov['override-expr'];
      exprs = Array.isArray(exprs) ? exprs.slice() : (exprs ? [String(exprs)] : []);
      exprs.push('.name = ' + JSON.stringify(CHAIN_PREFIX + pname + ' / ') + ' + .name');
      exprs.push('."dialer-proxy" = ' + JSON.stringify(CHAIN_ENTRY));
      ov2['override-expr'] = exprs;
      pclone.override = ov2;
      if (pclone.type === 'http') pclone.path = './proxy_providers/chain-' + encodeURIComponent(pname) + '.yaml';
      providers['__chain_exit__' + pname] = pclone;
    }
    cfg['proxy-providers'] = providers;

    for (gi = 0; gi < groups.length; gi++) {
      var group = groups[gi], gname = String(group.name || ''), ex;
      if (gname === CHAIN_ENTRY || gname === CHAIN_EXIT || gname === '全球直连' || gname === '广告拦截') continue;
      group.proxies = group.proxies || [];
      if (group.proxies.indexOf(CHAIN_EXIT) < 0) group.proxies.push(CHAIN_EXIT);
      ex = String(group['exclude-filter'] || '');
      if (ex.indexOf(CHAIN_EXCLUDE) < 0) group['exclude-filter'] = ex ? ex + '|' + CHAIN_EXCLUDE : CHAIN_EXCLUDE;
    }

    groups.push({
      name: CHAIN_ENTRY,
      type: 'select',
      'include-all': true,
      'exclude-filter': EXCLUDE + '|' + CHAIN_ENTRY_EXCLUDE,
      'empty-fallback': 'REJECT',
      proxies: ['全球直连'],
      icon: ICON + 'Proxy.svg'
    });
    groups.push({
      name: CHAIN_EXIT,
      type: 'select',
      'include-all': true,
      filter: '^' + CHAIN_PREFIX,
      'empty-fallback': 'REJECT',
      icon: ICON + 'Global.svg'
    });
    cfg['proxy-groups'] = groups;
    return cfg;
  }

  // ===== 基础 =====
  config['mixed-port'] = 7890;
  config['allow-lan'] = false;
  config['unified-delay'] = true;
  config['tcp-concurrent'] = true;
  config['keep-alive-interval'] = 60;
  config['external-controller'] = '127.0.0.1:9090';
  config['mode'] = 'rule';
  config['log-level'] = 'warning';
  config['profile'] = { 'store-selected': true, 'store-fake-ip': true };

  // ===== 嗅探 =====
  config['sniffer'] = {
    enable: true,
    'override-destination': false,
    sniff: {
      QUIC: { ports: [443] },
      TLS: { ports: [443, 8443] },
      HTTP: { ports: [80, '8080-8880'], 'override-destination': true }
    },
    'force-domain': ['+.netflix.com', '+.nflxvideo.net', '+.media.dssott.com', '+.amazonaws.com', '+.tiktok.com'],
    'skip-domain': ['+.push.apple.com', 'dlg.io.mi.com', '+.mi.com', '+.xiaomi.com', '+.miwifi.com', '+.oray.com', '+.sunlogin.net']
  };

  // ===== TUN（开关交给客户端 UI，这里只定参数）=====
  config['tun'] = {
    enable: false,
    'auto-route': true,
    'auto-detect-interface': true,
    mtu: 1480,
    'dns-hijack': ['any:53', 'tcp://any:53']
  };

  // ===== hosts =====
  config['hosts'] = {
    'services.googleapis.cn': ['services.googleapis.com'],
    '+.mcdn.bilivideo.com': ['0.0.0.0'],
    '+.mcdn.bilivideo.cn': ['0.0.0.0'],
    '+.edge.mountaintoys.cn': ['0.0.0.0'],
    '+.h2.smtcdns.net': ['0.0.0.0']
  };

  // ===== DNS =====
  config['dns'] = {
    enable: true,
    ipv6: true,
    'cache-algorithm': 'arc',
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-range6': 'fc00::/18',
    'fake-ip-filter': FAKE_IP_FILTER,
    'respect-rules': true,
    'default-nameserver': ['223.6.6.6', '119.29.29.29'],
    nameserver: DOH,
    'direct-nameserver': DOH,
    'direct-nameserver-follow-policy': true,
    'proxy-server-nameserver': DOH,
    'nameserver-policy': {
      'rule-set:geosite-category-ads-all': 'rcode://success',
      'rule-set:douyin': ['system', '180.184.1.1', '180.184.2.2']
    }
  };

  // ===== 策略组（不含自动测速组）=====
  config['proxy-groups'] = [
    { name: '节点选择', type: 'select', 'include-all': true, 'exclude-filter': EXCLUDE, proxies: ['全球直连'], icon: ICON + 'Proxy.svg' },
    { name: 'AI 助手', type: 'select', 'include-all': true, 'exclude-filter': EXCLUDE, proxies: ['节点选择'], icon: ICON + 'OpenAI.svg' },
    { name: '全球直连', type: 'select', proxies: ['DIRECT'], icon: ICON + 'China.svg' },
    { name: '广告拦截', type: 'select', proxies: ['REJECT', 'DIRECT'], icon: ICON + 'AdBlock.svg' },
    { name: '漏网之鱼', type: 'select', proxies: ['节点选择', '全球直连'], icon: ICON + 'Stack.svg' }
  ];

  // ===== 规则集 =====
  for (i = 0; i < P.length; i++) {
    providers[P[i][0]] = {
      type: 'http',
      behavior: P[i][0].indexOf('geoip') === 0 ? 'ipcidr' : 'domain',
      format: 'mrs',
      interval: 86400,
      proxy: 'DIRECT',
      url: P[i][1] === null ? ADS : MRS + P[i][1]
    };
  }
  config['rule-providers'] = providers;

  // ===== 分流规则 =====
  rules = rules.concat(segRules('private'));
  for (i = 0; i < DIRECT_DOMAINS.length; i++) rules.push('DOMAIN-SUFFIX,' + DIRECT_DOMAINS[i] + ',DIRECT');
  for (i = 0; i < PROXY_DOMAINS.length; i++) rules.push('DOMAIN-SUFFIX,' + PROXY_DOMAINS[i] + ',节点选择');
  for (i = 0; i < REJECT_DOMAINS.length; i++) rules.push('DOMAIN-SUFFIX,' + REJECT_DOMAINS[i] + ',REJECT');
  for (i = 0; i < TRACKER_DOMAINS.length; i++) rules.push('DOMAIN-SUFFIX,' + TRACKER_DOMAINS[i] + ',REJECT');
  for (i = 0; i < BYTEDANCE_KEEP.length; i++) rules.push('DOMAIN-SUFFIX,' + BYTEDANCE_KEEP[i] + ',DIRECT');
  rules = rules.concat(segRules('ads'));
  rules = rules.concat(segRules('ai'));
  for (i = 0; i < AD_DOMAINS.length; i++) rules.push('DOMAIN-SUFFIX,' + AD_DOMAINS[i] + ',REJECT');
  rules.push('AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,geosite-cn),(RULE-SET,geoip-cn)))))),REJECT');
  rules = rules.concat(segRules('proxy'));
  rules = rules.concat(segRules('direct'));
  rules.push('MATCH,漏网之鱼');
  config['rules'] = rules;

  if (ENABLE_CHAIN === true) applyChainProxy(config);

  return config;
}
