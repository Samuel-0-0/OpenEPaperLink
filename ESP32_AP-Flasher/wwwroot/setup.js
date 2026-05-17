const $ = document.querySelector.bind(document);

window.addEventListener("load", function () {
    fetch("get_wifi_config")
        .then(response => response.json())
        .then(data => {
            $('#ssid').value = data.ssid || "";
            $('#pw').value = data.pw || "";
            $('#ip').value = data.ip || "";
            $('#mask').value = data.mask || "";
            $('#gw').value = data.gw || "";
            $('#dns').value = data.dns || "";
            $('#mac').innerHTML = data.mac || "";
        });
});

function pad(text, count) {
    let t = text + "";
    return t.padEnd(count, "\u00A0").slice(0, count);
}

$('#listssid').addEventListener('click', () => {
    document.body.style.cursor = 'progress';
    $('#listssid').innerHTML = '&#x231B;';
    getSsidList();
});

function getSsidList() {
    fetch("get_ssid_list")
        .then(response => response.json())
        .then(data => {
            if (data.scanstatus < 0) {
                setTimeout(getSsidList, 3000);
                return;
            } else {
                const select = document.createElement('select');
                select.id = 'ssid';

                data.networks.forEach(network => {
                    if (network.ssid) {
                        const option = document.createElement('option');
                        option.value = network.ssid;
                        console.log(network);
                        option.text = pad(network.rssi, 5) + pad(network.ssid, 24);
                        select.appendChild(option);
                    }
                });

                let ssidval = $('#ssid').value;
                $('#ssid').replaceWith(select);
                $('#ssid').value = ssidval;
            }
            document.body.style.cursor = 'default';
            $('#listssid').innerHTML = '查找 SSID';
        });
};

$('#connect').addEventListener('click', () => {
    const data = {
        ssid: $('#ssid').value,
        pw: $('#pw').value,
        ip: $('#ip').value,
        mask: $('#mask').value,
        gw: $('#gw').value,
        dns: $('#dns').value
    };

    fetch('save_wifi_config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (response.ok) {
                console.log('WiFi 设置已成功保存');
                let url = "/";
                if ($('#ip').value) url = "http://" + $('#ip').value + "/";
                $('.window').innerHTML = "<h1>WiFi 设置已保存...</h1>正在重启...<br>请稍等几秒钟，然后转到<a href=\"" + url + "\">接入点网页</a>。";
            } else {
                console.log('保存 WiFi 设置时出错');
            }
        })
        .catch(error => {
            console.log('网络错误：', error);
        });
});