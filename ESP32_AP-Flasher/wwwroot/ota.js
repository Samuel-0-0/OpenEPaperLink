var repo = apConfig.repo || 'OpenEPaperLink/OpenEPaperLink';
var repoUrl = 'https://api.github.com/repos/' + repo + '/releases';

const $ = document.querySelector.bind(document);

let running = false;
let errors = 0;
let env = '', currentVer = '', currentBuildtime = 0;
let buttonState = false;
let gIsC6 = false;
let gIsH2 = false;
let gModuleType = '';
let gShortName = '';
let gCurrentRfVer = 0;

export async function initUpdate() {
    if (apConfig.C6 == 1) {
        gIsC6 = true;
        gModuleType = "ESP32-C6";
        gShortName = "C6";
    }
    else if (apConfig?.H2 && apConfig.H2 == 1) {
        gIsH2 = true;
        gModuleType = "ESP32-H2";
        gShortName = "H2";
    }
    else {
        gModuleType = "未知"
    }
    $('#radio_release_title').innerHTML = gModuleType + " 固件";

    const response = await fetch("version.txt");
    let filesystemversion = await response.text();
    if (!filesystemversion) filesystemversion = "未知";
    $('#repo').value = repo;

    const envBox = $('#environment');
    if (envBox?.tagName === 'SELECT') {
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.id = 'environment';
        envBox.parentNode.replaceChild(inputElement, envBox);
    }
    $('#environment').value = '';
    $('#environment').setAttribute('readonly', true);
    $('#repo').removeAttribute('readonly');
    $('#confirmSelectRepo').style.display = 'none';
    $('#cancelSelectRepo').style.display = 'none';
    $('#selectRepo').style.display = 'inline-block';
    $('#repoWarning').style.display = 'none';

    const sdata = await fetch("sysinfo")
        .then(response => {
            if (response.status != 200) {
                print("获取系统信息时出错: " + response.status, "red");
                if (response.status == 404) {
                    print("您当前的固件版本尚不支持 OTA 更新。");
                    print("请手动最后更新一次。");
                    disableButtons(true);
                }
                return {};
            } else {
                return response.json();
            }
        })
        .catch(error => {
            print('获取系统信息时出错: ' + error, "red");
        });

    if (sdata.env) {
        print(`当前环境:            ${sdata.env}`);
        print(`构建日期:            ${formatEpoch(sdata.buildtime)}`);
        print(`ESP32 版本:          ${sdata.buildversion}`);
        print(`文件系统版本:        ${filesystemversion}`);
        print(`PSRAM 大小:          ${sdata.psramsize}`);
        print(`闪存大小:            ${sdata.flashsize}`);
        if (gModuleType !== '') {
            let hex_ver = sdata.ap_version && !isNaN(sdata.ap_version)
                ? ('0000' + sdata.ap_version.toString(16)).slice(-4)
                : '未知';
            print(`${gModuleType} 版本:     ${hex_ver}`);
        }
        print("--------------------------", "gray");
        env = apConfig.env || sdata.env;
        if (sdata.env != env) {
            print(`警告：您选择的构建环境 ${env} 与当前使用的 ${sdata.env} 不同。\n仅在您清楚操作的情况下，使用不匹配的构建环境更新固件。`, "yellow");
        }
        currentVer = sdata.buildversion;
        currentBuildtime = sdata.buildtime;
        gCurrentRfVer = sdata.ap_version;
        if (sdata.rollback) $("#rollbackOption").style.display = 'block';
        $('#environment').value = env;
    }

    const rdata = await fetch(repoUrl).then(response => response.json())
    const JsonName = 'firmware_' + gShortName + '.json';
    const releaseDetails = rdata.map(release => {
        const assets = release.assets;
        const filesJsonAsset = assets.find(asset => asset.name === 'filesystem.json');
        const binariesJsonAsset = assets.find(asset => asset.name === 'binaries.json');
        const containsEnv = assets.find(asset => asset.name === env + '.bin');
        const firmwareAsset = assets.find(asset => asset.name === JsonName);
        if (filesJsonAsset && binariesJsonAsset && containsEnv) {
            return {
                html_url: release.html_url,
                tag_name: release.tag_name,
                name: release.name,
                date: formatDateTime(release.published_at),
                author: release.author.login,
                file_url: filesJsonAsset.browser_download_url,
                bin_url: binariesJsonAsset.browser_download_url,
                firmware_url: firmwareAsset?.browser_download_url,
            }
        };
    })

    if (releaseDetails.length === 0) {
        easyupdate.innerHTML = ("未找到发布版本。");
    } else {
        const release = releaseDetails[0];
        if (release?.tag_name) {
            if (release.tag_name == currentVer) {
                easyupdate.innerHTML = `版本 ${currentVer}。您已是最新。`;
            } else if (release.date < formatEpoch(currentBuildtime - 30 * 60)) {
                easyupdate.innerHTML = `您的版本比最新发布日期还新。<br>您是开发者吗？:-)`;
            } else {
                easyupdate.innerHTML = `版本 ${currentVer} 到 ${release.tag_name} 的更新可用。<button onclick="otamodule.updateAll('${release.bin_url}','${release.file_url}','${release.tag_name}')">立即更新！</button>`;
            }
        }
    }

    const table = document.createElement('table');
    const tableHeader = document.createElement('tr');
    tableHeader.innerHTML = '<th>发布版本</th><th>日期</th><th>名称</th><th colspan="2"><center>更新</center></th><th>备注</th>';
    table.appendChild(tableHeader);

    let rowCounter = 0;
    let radioFwCounter = 0;
    releaseDetails.forEach(release => {
        if (rowCounter < 4 && release?.html_url) {
            const tableRow = document.createElement('tr');
            let tablerow = `<td><a href="${release.html_url}" target="_new">${release.tag_name}</a></td><td>${release.date}</td><td>${release.name}</td><td><button type="button" onclick="otamodule.updateESP('${release.bin_url}', true)">ESP32</button></td><td><button type="button" onclick="otamodule.updateWebpage('${release.file_url}','${release.tag_name}', true)">文件系统</button></td>`;
            if (release.tag_name == currentVer) {
                tablerow += "<td>当前版本</td>";
            } else if (release.date < formatEpoch(currentBuildtime)) {
                tablerow += "<td>较旧</td>";
            } else {
                tablerow += "<td>较新</td>";
            }
            tableRow.innerHTML = tablerow;
            table.appendChild(tableRow);
            rowCounter++;
        }
        if (release?.firmware_url) {
            radioFwCounter++;
        }
    });
    $('#releasetable').innerHTML = "";
    $('#releasetable').appendChild(table);

    if (radioFwCounter > 0) {
        const table1 = document.createElement('table');
        const tableHeader1 = document.createElement('tr');

        tableHeader1.innerHTML = '<th>发布版本</th><th>日期</th><th>名称</th><th><center>更新</center></th><th>版本</th><th>备注</th>';
        table1.appendChild(tableHeader1);

        rowCounter = 0;
        for (const release of releaseDetails) {
            if (rowCounter < 4 && release?.firmware_url) {
                const tableRow = document.createElement('tr');
                var tablerow;
                var firmwareVer = "未知";
                var release_url = release.firmware_url;

                tablerow = `<td><a href="${release.html_url}" target="_new">${release.tag_name}</a></td><td>${release.date}</td><td>${release.name}</td>`;
                tablerow += `<td><button type="button" onclick="otamodule.updateC6H2('${release_url}')">${gModuleType}</button></td>`;
                const firmwareUrl = 'http://proxy.openepaperlink.org/proxy.php?url=' + release.firmware_url;
                firmwareVer = await fetch(firmwareUrl, { method: 'GET' })
                    .then(function (response) { return response.json(); })
                    .then(function (response) {
                        return response[2]['version'];
                    })
                    .catch(error => {
                        print('获取发布版本时出错:' + error, "red");
                    });
                tablerow += '<td>' + firmwareVer + '</td><td>';
                if (firmwareVer != '未知') {
                    let Ver = Number('0x' + firmwareVer);
                    if (Ver > gCurrentRfVer) {
                        tablerow += '较新';
                    }
                    else if (Ver < gCurrentRfVer) {
                        tablerow += '较旧';
                    }
                    else if (!Number.isNaN(Ver)) {
                        tablerow += '当前版本';
                    }
                }
                tablerow += '</td>';
                tableRow.innerHTML = tablerow;
                table1.appendChild(tableRow);
                rowCounter++;
            }
        };

        $('#radio_releasetable').innerHTML = "";
        $('#radio_releasetable').appendChild(table1);
    }

    const table2 = document.createElement('table');
    {
        const tableHeader2 = document.createElement('tr');
        tableHeader2.innerHTML = '<th>固件</th><th><center>更新</center></th>';
        table2.appendChild(tableHeader2);
        const tableRow = document.createElement('tr');
        tablerow = '<td title="手动上传，确保四个文件都存在">来自 <a href="/edit" target="littlefs">文件系统</a> 的二进制文件</td>';
        tablerow += `<td><button type="button" onclick="otamodule.updateC6H2('')">${gModuleType}</button></td>`;
        tableRow.innerHTML = tablerow;
        table2.appendChild(tableRow);
    }
    {
        const tableRow = document.createElement('tr');
        const Url = "https://raw.githubusercontent.com/" + repo +
            "/master/binaries/ESP32-" + gShortName +
            "/firmware_" + gShortName + ".json";

        tablerow = `<td><a href="https://github.com/${repo}/tree/master/binaries/ESP32-${gShortName}/" target="_new">仓库最新版本</a></td>`;
        tablerow += `<td><button type="button" onclick="otamodule.updateC6H2('${Url}')">${gModuleType}</button></td>`;
        tableRow.innerHTML = tablerow;
        table2.appendChild(tableRow);
    }
    $('#radio_releasetable1').innerHTML = "";
    $('#radio_releasetable1').appendChild(table2);

    disableButtons(buttonState);
}

export function updateAll(binUrl, fileUrl, tagname) {
    updateWebpage(fileUrl, tagname, false)
        .then(() => {
            fetchAndCheckTagtypes(true);
        })
        .then(() => {
            updateESP(binUrl, false);
        })
        .catch(error => {
            console.error(error);
        });
}

export async function updateWebpage(fileUrl, tagname, showReload) {
    return new Promise((resolve, reject) => {
        (async function () {
            try {
                if (running) return;
                if (showReload) {
                    if (!confirm("确认更新文件系统")) return;
                } else {
                    if (!confirm("确认更新 ESP32 和文件系统")) return;
                }

                disableButtons(true);
                running = true;
                errors = 0;
                const consoleDiv = document.getElementById('updateconsole');
                consoleDiv.scrollTop = consoleDiv.scrollHeight;

                print("正在更新 littleFS 分区...");

                fetch("//openepaperlink.eu/getupdate/?url=" + fileUrl)
                    .then(response => response.json())
                    .then(data => {
                        checkfiles(data);
                    })
                    .catch(error => {
                        print('获取数据时出错:' + error, "red");
                    });

                const checkfiles = async (files) => {
                    const updateactions = files.find(files => files.name === "update_actions.json");
                    if (updateactions) {
                        await fetchAndPost(updateactions.url, updateactions.name, updateactions.path);
                        try {
                            const response = await fetch("update_actions", {
                                method: "POST",
                                body: ''
                            });
                            if (response.ok) {
                                await response.text();
                            } else {
                                print(`执行更新操作时出错: ${response.status}`, "red");
                                errors++;
                            }
                        } catch (error) {
                            console.error(`调用更新操作时出错:` + error, "red");
                            errors++;
                        }
                    }

                    for (const file of files) {
                        try {
                            if (file.name != "update_actions.json") {
                                const url = "check_file?path=" + encodeURIComponent(file.path);
                                const response = await fetch(url);
                                if (response.ok) {
                                    const data = await response.json();
                                    if (data.filesize == file.size && data.md5 == file.md5) {
                                        print(`文件 ${file.path} 已是最新`, "green");
                                    } else if (data.filesize == 0) {
                                        await fetchAndPost(file.url, file.name, file.path);
                                    } else {
                                        await fetchAndPost(file.url, file.name, file.path);
                                    }
                                } else {
                                    print(`检查文件 ${file.path} 时出错: ${response.status}`, "red");
                                    errors++;
                                }
                            }
                        } catch (error) {
                            console.error(`检查文件 ${file.path} 时出错:` + error, "red");
                            errors++;
                        }
                    }
                    writeVersion(tagname, "version.txt", "/www/version.txt")
                    running = false;
                    if (errors) {
                        print("------", "gray");
                        print(`更新完成，出现 ${errors} 个错误。`, "red");
                        reject(error);
                    } else {
                        print("------", "gray");
                        print("更新成功。");
                        resolve();
                    }
                    disableButtons(false);

                    if (showReload) {
                        const newLine = document.createElement('div');
                        newLine.innerHTML = "<button onclick=\"location.reload()\">重新加载此页面</button>";
                        consoleDiv.appendChild(newLine);
                        consoleDiv.scrollTop = consoleDiv.scrollHeight;
                    }
                };
            } catch (error) {
                print('错误: ' + error, "red");
                errors++;
                reject(error);
            }
        })();
    });
}

export async function updateESP(fileUrl, showConfirm) {
    if (running) return;
    if (showConfirm) {
        if (!confirm("确认更新 ESP32")) return;
    }

    disableButtons(true);
    running = true;
    errors = 0;
    const consoleDiv = document.getElementById('updateconsole');
    consoleDiv.scrollTop = consoleDiv.scrollHeight;

    print("正在更新固件...");

    let binurl, binmd5, binsize;

    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
        try {
            const response = await fetch("//openepaperlink.eu/getupdate/?url=" + fileUrl + "&env=" + env);
            const responseBody = await response.text();
            if (!response.ok) {
                throw new Error("网络响应不正常: " + responseBody);
            }

            if (!responseBody.trim().startsWith("[")) {
                throw new Error("获取发布信息文件失败");
            }

            const data = JSON.parse(responseBody);
            const file = data.find((entry) => entry.name == env + '.bin');
            if (file) {
                binurl = "http://openepaperlink.eu/getupdate/?url=" + encodeURIComponent(file.url);
                binmd5 = file.md5;
                binsize = file.size;
                console.log(`"${file.name}" 的 URL: ${binurl}`);

                try {
                    const response = await fetch('update_ota', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: new URLSearchParams({
                            url: binurl,
                            md5: binmd5,
                            size: binsize
                        })
                    });

                    if (response.ok) {
                        await response.text();
                        print('OTA 更新已启动。');
                    } else {
                        print('启动 OTA 更新失败: ' + response.status, "red");
                    }
                } catch (error) {
                    print('OTA 更新期间出错: ' + error, "red");
                }
                break;
            } else {
                print(`在发布版本中未找到关于 "${env}" 的信息。`, "red");
            }
        } catch (error) {
            print('错误: ' + error.message, "yellow");
            retryCount++;
            print(`重试中... 第 ${retryCount} 次尝试`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    if (retryCount === maxRetries) {
        print("已达到最大重试次数。更新执行失败。", "red");
    }

    running = false;
    disableButtons(false);
}

$('#rollbackBtn').onclick = function () {
    if (running) return;

    disableButtons(true);
    running = true;
    errors = 0;
    const consoleDiv = document.getElementById('updateconsole');
    consoleDiv.scrollTop = consoleDiv.scrollHeight;

    print("正在回滚...");

    fetch("rollback", {
        method: "POST",
        body: ''
    })

    running = false;
    disableButtons(false);
}

export async function updateC6H2(Url) {
    if (running) return;
    disableButtons(true);
    running = true;
    errors = 0;
    const ReleaseUrl = Url.substring(0, Url.lastIndexOf('/'));
    const consoleDiv = document.getElementById('updateconsole');
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
    const formData = new FormData();

    print("正在刷写 " + gModuleType + " ...");
    formData.append('url', ReleaseUrl);

    fetch("update_c6", {
        method: "POST",
        body: formData
    })

    running = false;
    disableButtons(false);
}

$('#updateTagtypeBtn').onclick = function () {
    const cleanup = $('#tagtype_clean').checked;
    fetchAndCheckTagtypes(cleanup);
}

$('#selectRepo').onclick = function (event) {
    event.preventDefault();
    $('#updateconsole').innerHTML = '';

    let repoUrl = 'https://api.github.com/repos/' + $('#repo').value + '/releases';
    fetch(repoUrl)
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data) && data.length > 0) {
                const release = data[0];
                print("仓库已找到！最新发布版本: " + release.name + " 创建于 " + release.created_at);
                const assets = release.assets;
                const filesJsonAsset = assets.find(asset => asset.name === 'filesystem.json');
                const binariesJsonAsset = assets.find(asset => asset.name === 'binaries.json');
                if (filesJsonAsset && binariesJsonAsset) {
                    const updateUrl = "//openepaperlink.eu/getupdate/?url=" + binariesJsonAsset.browser_download_url + "&env=" + $('#repo').value;
                    return fetch(updateUrl);
                } else {
                    throw new Error("在发布资产中未找到 Json 文件 binaries.json 和/或 filesystem.json");
                }
            };
        })
        .then(updateResponse => {
            if (!updateResponse.ok) {
                throw new Error("网络响应不正常");
            }
            return updateResponse.text();
        })
        .then(responseBody => {
            if (!responseBody.trim().startsWith("[")) {
                throw new Error("获取发布信息文件失败");
            }
            const updateData = JSON.parse(responseBody).filter(item => !item.name.endsWith('_full.bin') && !item.name.includes('_H2.') && !item.name.includes('_C6.'));

            const inputParent = $('#environment').parentNode;
            const selectElement = document.createElement('select');
            selectElement.id = 'environment';
            updateData.forEach(item => {
                const option = document.createElement('option');
                option.value = item.name.replace('.bin', '');
                option.text = item.name.replace('.bin', '');
                selectElement.appendChild(option);
            });
            inputParent.replaceChild(selectElement, $('#environment'));
            $('#environment').value = env;
            $('#confirmSelectRepo').style.display = 'inline-block';
            $('#cancelSelectRepo').style.display = 'inline-block';
            $('#selectRepo').style.display = 'none';
            $('#repo').setAttribute('readonly', true);
            $('#repoWarning').style.display = 'block';
        })
        .catch(error => {
            print('获取发布版本时出错:' + error, "red");
        });
}

$('#cancelSelectRepo').onclick = function (event) {
    event.preventDefault();
    $('#updateconsole').innerHTML = '';
    initUpdate();
}

$('#confirmSelectRepo').onclick = function (event) {
    event.preventDefault();

    repo = $('#repo').value;
    let formData = new FormData();
    formData.append("repo", repo);
    formData.append("env", $('#environment').value);
    fetch("save_apcfg", {
        method: "POST",
        body: formData
    })
        .then(response => response.text())
        .then(data => {
            window.dispatchEvent(loadConfig);
            print('好的，已保存');
        })
        .catch(error => print('错误: ' + error));
    $('#updateconsole').innerHTML = '';
    repoUrl = 'https://api.github.com/repos/' + repo + '/releases';
    initUpdate();
}

export function print(line, color = "white") {
    const consoleDiv = document.getElementById('updateconsole');
    if (consoleDiv) {
        const isScrolledToBottom = consoleDiv.scrollHeight - consoleDiv.clientHeight <= consoleDiv.scrollTop;
        const newLine = document.createElement('div');
        newLine.style.color = color;
        if (line == "[reboot]") {
            newLine.innerHTML = "<button onclick=\"otamodule.reboot()\">重启</button>";
        } else {
            newLine.textContent = line;
        }
        consoleDiv.appendChild(newLine);
        if (isScrolledToBottom) {
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
    }
}

export function reboot() {
    print("正在重启... 5秒后重新加载网页...", "yellow");
    fetch("reboot", { method: "POST" });
    setTimeout(() => {
        location.reload();
    }, 5000);
}

function formatEpoch(epochTime) {
    const date = new Date(epochTime * 1000); // 将秒转换为毫秒

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatDateTime(utcDateString) {
    const localTimeZoneOffset = new Date().getTimezoneOffset();
    const date = new Date(utcDateString);
    date.setMinutes(date.getMinutes() - localTimeZoneOffset);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
    return formattedDate;
}

const fetchAndPost = async (url, name, path) => {
    try {
        print("正在更新 " + path);
        const response = await fetch(url);

        if (!response.ok) {
            print(`下载错误: ${response.status} ${response.body}`, "red");
            errors++;
        } else {
            const fileContent = await response.blob();

            const formData = new FormData();
            formData.append('path', path);
            formData.append('file', fileContent, name);

            const uploadResponse = await fetch('littlefs_put', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                print(`上传错误: ${uploadResponse.status} ${uploadResponse.body}`, "red");
                errors++;
            }
        }
    } catch (error) {
        print('错误: ' + error, "red");
        errors++;
    }
};

const writeVersion = async (content, name, path) => {
    try {
        print("正在上传 " + path);

        const formData = new FormData();
        formData.append('path', path);
        const blob = new Blob([content]);
        formData.append('file', blob, name);

        const uploadResponse = await fetch('littlefs_put', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            print(`${response.status} ${response.body}`, "red");
            errors++;
        }
    } catch (error) {
        print('错误: ' + error, "red");
        errors++;
    }
};

function disableButtons(active) {
    $("#configtab").querySelectorAll('button').forEach(button => {
        button.disabled = active;
    });
    buttonState = active;
}

async function fetchAndCheckTagtypes(cleanup) {
    print("正在更新标签类型定义...");
    const sortableGrid = $('#taglist');
    const gridItems = Array.from(sortableGrid.querySelectorAll('.tagcard:not(#tagtemplate)'));
    try {
        const response = await fetch('/edit?list=%2Ftagtypes');
        if (!response.ok) {
            print("获取标签类型列表失败", "red");
            throw new Error('获取标签类型列表失败');
        }
        const fileList = await response.json();

        for (const file of fileList) {
            const filename = file.name;
            print(filename, "green");
            let check = filename.endsWith('.json');
            let hwtype = parseInt(filename, 16);

            if (check && cleanup) {
                let isInUse = Array.from(gridItems).some(element => element.dataset.hwtype == hwtype);
                if (!isInUse) {
                    isInUse = Array.from(gridItems).some(element => element.dataset.usetemplate == hwtype);
                }
                if (!isInUse) {
                    print("未使用，正在删除", "yellow");
                    const formData = new FormData();
                    formData.append('path', '/tagtypes/' + filename);
                    fetch('/edit', {
                        method: 'DELETE',
                        body: formData
                    })
                    check = false;
                }
            }

            if (check) {
                let githubUrl = "https://raw.githubusercontent.com/" + repo + "/master/resources/tagtypes/" + filename;

                const localResponse = await fetch(`/tagtypes/${filename}`);
                const localJson = await localResponse.json();
                const localVersion = localJson.version || 0;

                const githubResponse = await fetch(githubUrl);
                const githubJson = await githubResponse.json();
                const githubVersion = githubJson.version || 0;

                if (githubVersion > localVersion) {
                    print("从版本 " + localVersion + " 更新到 " + githubVersion);
                    await fetchAndPost(githubUrl, filename, "/tagtypes/" + filename);
                }
            }
        }
        print("完成。");
    } catch (error) {
        print("错误: " + error, "red");
    }
}

function normalizeVersion(version) {
    return version.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}