<template>
  <!-- -帮助页面 -->
  <div id="help-section">
    <leftMenu :tabs="tabs" :translatedTabs="translatedTabs" @tabChange="handleTabChange">
    </leftMenu>
    <div class="help-content OO-box">
      <!--  中文帮助页面 -->
      <div id="help-dialog-vi" v-if="language === 'vi'" class="OO-scorll-box"
        style="display: flex;flex-direction: column;width: 100%;height: 100%;overflow-y: auto;overflow-x: hidden;">
        <!-- 根据选择的设置选项展示不同的设置内容 -->
        <!-- -名词解释 -->
        <Markdown :content="explainContentVi" v-if="currentTab === 'help-explain'"></Markdown>
        <!-- -导入mod -->
        <Markdown :content="importContentVi" v-if="currentTab === 'help-import'"></Markdown>
        <!-- -加载mod -->
        <Markdown :content="loadContentVi" v-if="currentTab === 'help-load'"></Markdown>
        <!-- -配置mod -->
        <Markdown :content="configContentVi" v-if="currentTab === 'help-config'"></Markdown>
        <!-- -预设 -->
        <Markdown :content="presetContentVi" v-if="currentTab === 'help-preset'"></Markdown>
        <!-- -自动化 -->
        <Markdown :content="autoContentVi" v-if="currentTab === 'help-auto'"></Markdown>
        <!-- -多个游戏 -->
        <Markdown :content="multipleGamesContentVi" v-if="currentTab === 'help-multiple-games'"></Markdown>
        <!-- -故障排除 -->
        <div v-if="currentTab === 'help-trouble'">
          <Markdown :content="troubleContentVi">
            <div class="OO-setting-bar" style="height: 50px !important;">
              <h3> Nhóm QQ </h3>
              <p> 877012859 </p>
            </div>
            <div class="OO-setting-bar">
              <h3> Discord </h3>
              <s-button class="OO-button-box" @click="iManager.openUrl('https://discord.gg/4RbjKJuVKS')">
                join Discord
              </s-button>
            </div>
          </Markdown>
        </div>
        <!-- -配置mod加载器 -->
        <Markdown :content="configModLoaderContentVi" v-if="currentTab === 'help-config-mod-loader'"></Markdown>

        <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
      </div>

      <!-- -帮助页面，但是英文 -->
      <div id="help-dialog-en" v-else class="OO-scorll-box"
        style="display: flex;flex-direction: column;width: 100%;height: 100%;overflow-y: auto;overflow-x: hidden;">
        <!-- -Explain -->
        <Markdown :content="explainContentEn" v-if="currentTab === 'help-explain'"></Markdown>
        <!-- -Import Mods -->
        <Markdown :content="importContentEn" v-if="currentTab === 'help-import'"></Markdown>
        <!-- -Config Mod Loader -->
        <Markdown :content="configModLoaderContentEn" v-if="currentTab === 'help-config-mod-loader'"></Markdown>
        <!-- -Load Mods -->
        <Markdown :content="loadContentEn" v-if="currentTab === 'help-load'"></Markdown>
        <!-- -Mods Config -->
        <Markdown :content="configContentEn" v-if="currentTab === 'help-config'"></Markdown>
        <!-- -Presets -->
        <Markdown :content="presetContentEn" v-if="currentTab === 'help-preset'"></Markdown>
        <!-- -Automation -->
        <Markdown :content="autoContentEn" v-if="currentTab === 'help-auto'"></Markdown>
        <!-- -Multi-Game Support -->
        <Markdown :content="multipleGamesContentEn" v-if="currentTab === 'help-multiple-games'"></Markdown>
        <!-- -Troubleshooting -->
        <div v-if="currentTab === 'help-trouble'">
          <Markdown :content="troubleContentEn">
            <div class="OO-setting-bar" style="height: 50px !important;">
              <h3> QQ Group </h3>
              <p> 877012859 </p>
            </div>
            <div class="OO-setting-bar">
              <h3> Discord </h3>
              <s-button class="OO-button-box" @click="iManager.openUrl('https://discord.gg/4RbjKJuVKS')">
                join Discord
              </s-button>
            </div>
          </Markdown>
        </div>

        <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

import leftMenu from '../components/leftMenu.vue';
import Markdown from '../components/markdown.vue';
import { EventType,EventSystem } from '../../helper/EventSystem'; 

import img_description from '../assets/description.png';
import img_description1 from '../assets/description1.png';
import img_description2 from '../assets/description2.png';
import img_description3 from '../assets/description3.png';

const explainContentVi =
  `# Điều kiện tiên quyết
Hãy đảm bảo bạn đã cài đặt 3dmigoto hoặc trình tải mod khác và chạy thành công. Nếu chưa cài đặt 3dmigoto, hãy cài đặt 3dmigoto trước. Nếu bạn không hiểu 3dmigoto là gì, hãy tự tìm hiểu.
Lưu ý rằng chương trình này chỉ là trình quản lý mod, không phải trình tải mod. Nó cần dựa vào 3dmigoto hoặc trình tải mod khác để tải mod.

Trước tiên, bạn cần hiểu chương trình này quản lý mod như thế nào:
Nó tạo liên kết ảo từ các mod lưu trong 【thư mục nguồn mod】 tới 【thư mục đích mod】.
【Trình tải mod】 sẽ đọc các mod trong 【thư mục đích mod】 rồi tải chúng vào game.
---
# Trước khi sử dụng, hãy giải thích một số thuật ngữ
Lưu ý rằng ba thư mục sau không được trùng nhau, nếu không chương trình sẽ không chạy bình thường:
- Thư mục đích mod
- Thư mục nguồn mod
- Thư mục preset
Nếu vẫn chưa hiểu, bạn có thể đặt trước thành một thư mục trống, quan sát chương trình hoạt động, rồi mới cài đặt.

Tôi sẽ dùng hình ảnh để giúp bạn hiểu rõ hơn:<br>
  <img src="${img_description1}" alt="description" style="width: 80%;height: auto;">
Vì vậy, logic suy ra file mod thực ra là như thế này.
  <img src="${img_description3}" alt="description" style="width: 80%;height: auto;">
Nếu bạn không hiểu sơ đồ trên, đây là một ví dụ trực quan hơn:
Giả sử chúng ta muốn mặc cho Klee bộ "Quần áo mới của Hoàng đế", thì:
  <img src="${img_description2}" alt="description" style="width: 80%;height: auto;">
"Thư mục đích mod" dùng để lưu các mod đang sử dụng.
"Thư mục nguồn mod" dùng để lưu tất cả các mod.
---
# Thư mục đích mod
Đây là thư mục mà trình tải mod của bạn thực sự tải:
- Với ZZMI, đó là thư mục Mods của ZZMI;
- Với XXMI, đó là thư mục nội bộ của XXMI /zzz/Mods
Chương trình này tải mod bằng cách thay thế thư mục Mods, và điều chỉnh động các file bên trong thư mục mod để tải mod, vì vậy đừng thêm bất kỳ file nào vào thư mục đích mod! Chỉ cần thêm mod của bạn vào thư mục nguồn mod.
# Thư mục nguồn mod
Đây là thư mục mà chương trình này đọc mod, và cũng là thư mục bạn nên dùng để lưu mod. Nó nên được đặt thành một thư mục trống ở bất kỳ đâu, sau đó bạn cần thêm mod của mình vào thư mục này
# Thư mục preset
Đây là thư mục mà chương trình này dùng để lưu preset mod. Chương trình sẽ lưu một nhóm cấu hình mod tại đây. Sau khi cấu hình, bạn sẽ nhanh chóng chuyển đổi giữa các tổ hợp mod khác nhau qua chức năng preset. Nó nên được đặt thành một thư mục trống ở bất kỳ đâu
# Về chương trình này
# Nguyên lý hoạt động
Chương trình này tải mod bằng cách thay thế thư mục Mods, và điều chỉnh động các file bên trong thư mục mod để tải mod.
  <img src="${img_description}" alt="description" style="width: 50%;height: auto;">
`;

const importContentVi =
  `# Nhập mod
Có ba cách để nhập mod:
1. Thêm thư mục mod vào thư mục nguồn mod, chương trình sẽ đọc thư mục mod từ thư mục nguồn.
2. Kéo thư mục mod đã giải nén vào chương trình, chương trình sẽ tự động thêm thư mục mod vào thư mục nguồn mod.
3. Kéo file nén vào chương trình, chương trình sẽ tự động giải nén và thêm thư mục mod vào thư mục nguồn mod. Nếu file nén có mật khẩu, chương trình sẽ yêu cầu bạn nhập mật khẩu, rồi tự động giải nén và thêm thư mục mod vào thư mục nguồn mod.

Tất cả các cách về bản chất đều là thêm thư mục mod vào thư mục nguồn mod, vì vậy bạn cần cấu hình đường dẫn của thư mục nguồn mod trước.
# Sau khi nhập
1. Khi thêm mod trực tiếp vào thư mục nguồn mod, bạn cần làm mới chương trình để thấy các mod mới hiển thị dưới dạng thẻ trong danh sách mod.
2. Khi kéo thư mục mod đã giải nén hoặc file nén, chương trình sẽ tự động làm mới và mở trang chỉnh sửa mod, nơi bạn có thể chỉnh sửa thông tin mod. Để biết thêm thông tin, hãy xem 【Cấu hình mod】.
---
# Các vấn đề có thể gặp
# Thêm thư mục mod vào thư mục nguồn mod nhưng không hiển thị trong danh sách mod
1. Kiểm tra đường dẫn của thư mục nguồn mod có đúng không.
2. Kiểm tra trong thư mục nguồn mod có thư mục mod không.
3. Thử mở lại chương trình.
Nếu các cách trên không giải quyết được vấn đề, hãy xem 【Khắc phục sự cố】.
# Cảnh báo sau khi kéo file nén
1. Kiểm tra file nén có đầy đủ không, chương trình không hỗ trợ file nén chia nhỏ.
2. Kiểm tra file nén có mật khẩu không, và mật khẩu đã nhập đúng chưa.
`;
const configModLoaderContentVi =
  `# Tải mod
Chương trình này chỉ là trình quản lý mod, bạn cần tải thêm một trình tải game để tải mod. Nó có thể là 3dmigoto, zzmi, xxmi, v.v. Dưới đây tôi sẽ giới thiệu cách dùng chương trình này với các trình tải phổ biến.
# Loại 3dmigoto
Đây là các trình tải mod chưa đóng gói, mà tôi rất khuyên dùng. Ưu điểm của chúng là: cơ bản, ít lỗi nhất, phản hồi nhanh và không có tính năng thừa.

Bạn cũng có thể tìm các trình tải mod 3dmigoto đã tùy chỉnh cho từng game, ví dụ:
-
[ZZMI - Zenless Zone Zero Model Importer GitHub](https://github.com/leotorrez/ZZ-Model-Importer)
[SRMI - Honkai: Star Rail Model Importer GitHub](https://github.com/SilentNightSound/SR-Model-Importer)
[GIMI - Genshin Impact Model Importer GitHub](https://github.com/SilentNightSound/GI-Model-Importer)
[WWMI - Wuthering Waves Model Importer GitHub](https://github.com/SpectrumQT/WWMI)
v.v.
-

Để dùng chương trình này với các trình tải mod này, bạn chỉ cần đặt thư mục nguồn mod thành thư mục Mods của trình tải mod.
Nếu bạn muốn dùng tính năng 【Tự động mở game và trình tải mod】, bạn cần đặt đường dẫn file exe của trình tải mod thành đường dẫn trình tải mod.
---
# XXMI
XXMI về bản chất là một trình tải mod 3dmigoto có giao diện người dùng. Ưu điểm của nó là: có giao diện người dùng và có thể chuyển đổi giữa nhiều game.
Vì chương trình này thực ra chỉ thay thế thư mục Mods và điều chỉnh động các file bên trong thư mục mod để tải mod, nên bạn chỉ cần đặt thư mục đích mod thành thư mục Mods của trình tải mod. Thư mục nguồn mod là thư mục bạn thực sự dùng để lưu mod, và nó có thể ở bất kỳ đâu.

Để có trải nghiệm tốt hơn, chúng ta có thể cấu hình XXMI để khởi động chương trình này khi mở game, có hai cách:
# Dùng XXMI để mở XXMM
1. Mở XXMI Launcher
2. Chọn game
3. Bấm vào cài đặt (biểu tượng bánh răng)
4. Trong cài đặt nâng cao, bật run pre-launch, và đặt pre-launch path thành đường dẫn của chương trình này, nhớ thêm dấu ngoặc kép và bỏ tích tùy chọn wait
5. Nhớ bỏ tích tùy chọn wait

Như vậy, khi bạn bấm bắt đầu game trong XXMI, XXMI sẽ khởi động trình tải mod, game và chương trình này
# Dùng chương trình này để mở XXMI
1. Mở chương trình này
2. Mở trang cài đặt
3. Tìm mục cấu hình của plugin tự động khởi động
4. Đặt trình tải mod thành đường dẫn file exe của XXMI
5. Bấm nút khởi động trình tải mod và kiểm tra xem có khởi động được trình tải mod bình thường không

Như vậy, mỗi lần bạn mở chương trình này, nó sẽ tự động khởi động trình tải mod, rồi bạn có thể dùng XXMI để khởi động game.
`;

const loadContentVi =
  `# Sau khi cấu hình trình tải mod
Trước tiên, bạn cần đảm bảo đã chỉ định đúng đường dẫn của 【thư mục nguồn mod】 và 【thư mục đích mod】.
Nếu bạn không chắc về chức năng của hai thư mục này, hãy xem 【Tổng quan】.
Lưu ý rằng bạn nên sao lưu mod của mình để tránh mất mát do thao tác nhầm.
# Từng bước một, đừng hỏi vì sao
1. Đảm bảo bạn đã cấu hình đúng đường dẫn của 【thư mục nguồn mod】 và 【thư mục đích mod】.
2. Trong 【thư mục nguồn mod】 của bạn có vài mod, tồn tại dưới dạng thư mục.
3. Trong 【thư mục đích mod】 của bạn không có file nào, nó phải là một thư mục trống.
4. Bạn có thể thấy các thẻ mod của mình trong 【danh sách mod】.
Nếu bạn thấy có vấn đề ở các bước trên, hãy xem 【Khắc phục sự cố】.
# Nếu các bước trên không có vấn đề, thì
1. Bấm chuột trái vào bất kỳ thẻ mod nào trong 【danh sách mod】, bạn sẽ thấy thẻ có viền sáng kèm hiệu ứng. Điều đó nghĩa là mod đã được đặt thành trạng thái đã chọn.
2. Bạn có thể bấm thêm vài thẻ mod, chúng sẽ được thêm vào trạng thái đã chọn.
3. Bấm nút 【Áp dụng】 dưới trang 【Mod】, chương trình sẽ tạo liên kết ảo cho các mod đã chọn tới 【thư mục đích mod】.
4. Mở 【thư mục đích mod】, bạn sẽ thấy thư mục chứa các liên kết ảo tới các mod đã chọn.

Nếu bạn hoàn thành thành công các bước trên, chúc mừng, bạn đã tải mod thành công.
Sau đó trình tải mod sẽ đọc các mod trong 【thư mục đích mod】 và tải chúng vào game.
`;
const configContentVi =
  `# Thông tin mod
Mod được hiển thị dưới dạng thẻ trong 【danh sách mod】, và chúng ta muốn thêm nhiều thông tin hơn cho chúng để quản lý tốt hơn.
Chương trình thêm các thông tin sau cho mỗi mod:
1. Nhân vật (một thẻ mà chương trình dùng để lọc mod, nó không nhất thiết phải là nhân vật, có thể là thẻ khác)
2. Phím tắt
3. Mô tả
4. Ảnh xem trước
# Chỉnh sửa thông tin mod
1. Sau khi bấm chuột trái vào thẻ mod trong 【danh sách mod】, bạn sẽ thấy nút 【Chỉnh sửa】 ở phía dưới thanh thông tin chi tiết bên phải. Bấm vào đó để mở cửa sổ chỉnh sửa thông tin mod.
2. Bấm chuột phải vào thẻ mod trong 【danh sách mod】 sẽ mở trực tiếp cửa sổ chỉnh sửa thông tin mod.
# Đổi ảnh xem trước của mod
Ngoài việc bấm dấu + ở bên phải 【ảnh xem trước của mod】 trong cửa sổ chỉnh sửa thông tin mod để đổi ảnh xem trước, bạn cũng có thể kéo trực tiếp hình ảnh vào thẻ mod để đổi ảnh xem trước.
1. Kéo một hình ảnh trên máy vào thẻ mod trong 【danh sách mod】 để đổi ảnh xem trước của mod.
2. Kéo một hình ảnh từ trang trình duyệt vào thẻ mod trong 【danh sách mod】 để đổi ảnh xem trước của mod.

Tôi rất khuyên dùng cách kéo hình ảnh từ trình duyệt để đổi ảnh xem trước của mod, vì như vậy bạn có thể dùng trực tiếp các ảnh xem trước có trên trang web mod.
`;
const presetContentVi =
  `# Chức năng preset
Chương trình cung cấp chức năng preset, cho phép bạn nhanh chóng chuyển đổi trạng thái bật/tắt của một nhóm mod.

Ở phía trái của trang 【Mod】, bạn có thể thấy danh sách chọn preset. Bạn có thể chuyển đổi preset bằng cách bấm vào các preset trong danh sách chọn preset.
Lúc đầu, chương trình sẽ có một preset mặc định.
# Thêm preset
1. Bấm nút "+" thêm preset ở phía dưới bên phải của danh sách preset ở phía trái trang 【Mod】, một cửa sổ preset mới sẽ hiện ra.
2. Trong cửa sổ preset mới, nhập tên của preset, rồi bấm 【OK】.
3. Bạn sẽ thấy một preset mới trong danh sách preset.
# Xóa preset
1. Bấm nút "ba gạch" quản lý preset ở phía dưới bên phải của danh sách preset ở phía trái trang 【Mod】, thư mục lưu preset sẽ hiện ra.
2. Sau đó bạn có thể xóa các file preset trong thư mục preset để xóa preset.
---
# Preset mặc định
Preset mặc định là preset đi kèm với chương trình, bạn không thể xóa nó, và nó sẽ không ghi lại trạng thái bật/tắt của bất kỳ mod nào.
Khi chuyển sang preset mặc định, chương trình sẽ chuyển tất cả các mod sang trạng thái tắt.
Nếu bạn muốn lưu trạng thái bật/tắt mod hiện tại, hãy tạo một preset mới.

Khi bạn muốn kiểm tra một mod riêng lẻ hoặc loại trừ ảnh hưởng của một mod lên game, nó sẽ là trợ thủ đắc lực của bạn.
`;
const autoContentVi =
  `# Tự động hóa
"Mỗi lần mở game tôi phải mở trình tải mod và chương trình này, rồi mới mở game. Thật phiền phức!"
"Sau khi đổi mod, tôi vẫn phải làm mới trình tải mod bằng tay. Thật phiền phức!"
"Tôi muốn mở game và trình tải mod chỉ với một cú bấm!"
"Tôi muốn làm mới mod trong game!"

Nếu bạn gặp các phiền toái trên, bạn có thể thử dùng chức năng tự động hóa của chương trình. Hiện tại nó tồn tại dưới dạng plugin, và bạn có thể tìm thấy nó trên trang 【Cài đặt】.
---
---
# Cấu hình tự động khởi động
1. Mở trang 【Cài đặt】.
2. Tìm mục cấu hình của 【Plugin tự động khởi động】.
3. Đặt đường dẫn của plugin theo hướng dẫn.
4. Bấm các nút 【Khởi động trình tải mod】 và 【Khởi động game】 để kiểm tra xem trình tải mod và game có khởi động bình thường không.

Nếu cấu hình đúng, chương trình sẽ tự động khởi động trình tải mod và game mỗi lần bạn mở chương trình này.
# Cấu hình tự động làm mới
1. Mở trang 【Cài đặt】.
2. Tìm mục cấu hình của 【Làm mới trong game】.
3. Bật công tắc 【Làm mới sau khi áp dụng】.
4. Cấu hình 【Tên tiến trình】 và 【Mã phím ảo để làm mới】 theo hướng dẫn.

1. Tên tiến trình là tên tiến trình của game của bạn, bạn có thể xem qua trình quản lý tác vụ. Với Zenless Zone Zero, tên tiến trình là "ZenlessZoneZero.exe".
2. Mã phím ảo để làm mới là mã phím ảo của phím tắt mà trình tải mod của bạn dùng để làm mới mod. Bạn có thể tìm trên mạng "bảng mã phím ảo" để tìm mã phím ảo của phím tắt làm mới của trình tải mod của bạn. Thông thường, phím tắt làm mới là F10, và mã phím ảo tương ứng là 121.
`;
const multipleGamesContentVi =
  `# Hỗ trợ nhiều game
Bằng cách dùng cấu hình cục bộ thay vì cấu hình toàn cục, bạn có thể tạo nhiều cấu hình cho các game khác nhau để đặt trình tải mod, thư mục nguồn mod, thư mục đích mod, v.v.

# Tạo cấu hình cục bộ
1. Mở trang 【Cài đặt】.
2. Tìm trang 【Chuyển đổi cấu hình】.
3. Chọn đường dẫn của 【Lưu thành】, nó phải là một thư mục trống, rồi bấm Tạo lối tắt.

Sau đó, khi bạn mở chương trình bằng lối tắt tạo trên màn hình nền, chương trình sẽ tải cấu hình cục bộ bạn đã chọn, thay vì cấu hình toàn cục.

# Cách dùng nâng cao
Nếu bạn biết kiến thức dòng lệnh cơ bản, việc dùng cấu hình cục bộ thực ra là cung cấp tham số khởi động khi XXMM khởi động:

'xx mod manager.exe' --customConfig 'đường dẫn tới thư mục cấu hình cục bộ của bạn'

Bạn có thể thử dùng bat hoặc chương trình khác để khởi động chương trình bằng cách đặt tham số khởi động, để thực hiện tự động hóa trong các ứng dụng khác.
`;

const troubleContentVi =
  `# Khắc phục sự cố
Khi bạn gặp vấn đề, bạn có thể thử các cách sau để giải quyết:
1. Mở lại chương trình
2. Xem trang 【Trợ giúp】
3. Kiểm tra xem có phải là vấn đề của trình tải mod không, thử khởi động trình tải mod riêng và sao chép mod vào thư mục Mods của trình tải mod

Nếu bạn biết một chút về phát triển front-end, bạn có thể thử bấm Ctrl+Shift+I để mở công cụ dành cho nhà phát triển và kiểm tra thông báo lỗi.
Nếu bạn không giải quyết được vấn đề, hãy liên hệ với tôi.
`;
;

const explainContentEn =
  `# Prerequisites
Please make sure you have 3dmigoto or other mod loader installed and running successfully. If you haven't installed 3dmigoto yet, please install 3dmigoto first. If you don't understand what 3dmigoto is, please search it yourself.
Please note that this program is only a mod manager, not a mod loader. It needs to rely on 3dmigoto or other mod loaders to load mods.

First, you need to understand how this program manages mods:
It creates virtual links from the mods stored in the [mod source folder] to the [mod target folder].
The [mod loader] reads the mods in the [mod target folder] and loads them into the game.
---
# Before using it, let us explain some terms
Please note that the following three folders cannot be the same, otherwise the program will not run properly:
- Mod Target Folder
- Mod Source Folder
- Preset Folder
If you still don't understand, you can set it to an empty folder first, observe the program's operation, and then set it up.

I will use pictures to help you understand better:<br>
  <img src="${img_description1}" alt="description" style="width: 80%;height: auto;">
Therefore, the logic of mod file derivation is actually like this.
  <img src="${img_description3}" alt="description" style="width: 80%;height: auto;">
If you cannot understand the above diagram, here is a more intuitive one:
Suppose we want to dress Klee in the "Emperor's New Clothes", then:
  <img src="${img_description2}" alt="description" style="width: 80%;height: auto;">
The "mod target folder" is used to store the mods currently in use.
The "mod source folder" is used to store all the mods.
---
# Mod Target Folder
This is the folder actually loaded by your mod loader:
- For ZZMI, it is the ZZMI Mods folder;
- For XXMI, it is the XXMI internal folder /zzz/Mods
This program implements mod loading by proxying the Mods folder, and dynamically adjusts the files inside the mod folder to implement mod loading, so please do not add any files in the mod target folder! Just add your mod to the mod source folder.
# Mod Source Folder
This is the folder where this program reads mods, and the folder where you should store mods. It should be set to an empty folder anywhere, you will then need to add your mod to this folder
# Preset Folder
This is the folder used by this program to store mod presets. The program will store a set of mod configurations here. After the configuration, you will quickly switch between different mod combinations through the preset function. It should be set to an empty folder anywhere
# About this program
# Operating principle
This program implements mod loading by proxying the Mods folder, and dynamically adjusts the files inside the mod folder to implement mod loading.
  <img src="${img_description}" alt="description" style="width: 50%;height: auto;">
`;

const importContentEn =
  `# Import Mods
There are three ways to import mods:
1. Add the mod folder to the mod source folder, and the program will read the mod folder from the source folder.
2. Drag the unzipped mod folder into the program, and the program will automatically add the mod folder to the mod source folder.
3. Drag a zip file into the program, and the program will automatically unzip and add the mod folder to the mod source folder. If the zip file has a password, the program will prompt you to enter the password, and then automatically unzip and add the mod folder to the mod source folder.

All methods essentially add the mod folder to the mod source folder, so you need to configure the path of the mod source folder first.
# After Importing
1. By directly adding mods to the mod source folder, you need to refresh the program to see the new mods displayed as cards in the mod list.
2. By dragging the unzipped mod folder or zip file, the program will automatically refresh and open the mod editing page, where you can edit the mod information. For more information, please refer to [Mods Config].
---
# Possible Issues
# Adding mod folder to mod source folder, but not showing in mod list
1. Check if the path of the mod source folder is correct.
2. Check if there are mod folders in the mod source folder.
3. Try reopening the program.
If the above methods do not solve the problem, please refer to [Troubleshooting].
# Warning after dragging zip file
1. Check if the zip file is complete, the program does not support split zip files.
2. Check if the zip file has a password, and if the password is entered correctly.
`;

const configModLoaderContentEn =
  `# Loading Mods
This program is just a mod manager, you need to download a game loader to load mods. It can be 3dmigoto, zzmi, xxmi, etc. Below I will introduce how to use this program with common loaders.
# 3dmigoto Type
These are unwrapped mod loaders, which I highly recommend. Their advantages are: basic, least problematic, responsive, and no additional features.

You can also find 3dmigoto mod loaders customized for various games, such as:
-
[ZZMI - Zenless Zone Zero Model Importer GitHub](https://github.com/leotorrez/ZZ-Model-Importer)
[SRMI - Honkai: Star Rail Model Importer GitHub](https://github.com/SilentNightSound/SR-Model-Importer)
[GIMI - Genshin Impact Model Importer GitHub](https://github.com/SilentNightSound/GI-Model-Importer)
[WWMI - Wuthering Waves Model Importer GitHub](https://github.com/SpectrumQT/WWMI)
etc.
-

To use this program with these mod loaders, you only need to set the mod source folder to the Mods folder of the mod loader.
If you want to use the [Auto Open Game and Mod Loader] feature, you need to set the path of the mod loader's exe file to the mod loader path.
---
# XXMI
XXMI is essentially a 3dmigoto mod loader with a user interface. Its advantage is: it has a user interface and can switch between multiple games.
Because this program actually just proxies the Mods folder and dynamically adjusts the files inside the mod folder to implement mod loading, you only need to set the mod target folder to the Mods folder of the mod loader. The mod source folder is the folder you actually use to store mods, and it can be anywhere.

For a better experience, we can configure XXMI to start this program when launching the game, there are two ways:
# Use XXMI to launch XXMM
1. Open XXMI Launcher
2. Select the game
3. Click settings (gear icon)
4. In the advanced settings, enable run pre-launch, and set the pre-launch path to the path of this program, be sure to add double quotes and uncheck the wait option
5. Be sure to uncheck the wait option

This way, when you click start game in XXMI, XXMI will start the mod loader, the game, and this program
# Use this program to launch XXMI
1. Open this program
2. Open the settings page
3. Find the configuration item for auto-start plugin
4. Set the mod loader to the exe file path of XXMI
5. Click the button to start the mod loader and test if it can start the mod loader normally

This way, every time you open this program, it will automatically start the mod loader, and then you can use XXMI to start the game.
`;

const loadContentEn =
  `# After Configuring the Mod Loader
First, you need to ensure that you have correctly specified the paths of the [mod source folder] and [mod target folder].
If you are not sure about the functions of these two folders, please refer to [Explain].
Please note that it is recommended to back up your mods to prevent loss due to misoperation.
# Step by Step, Don't Ask Why
1. Ensure that you have correctly configured the paths of the [mod source folder] and [mod target folder].
2. There are several mods in your [mod source folder], which exist as folders.
3. There are no files in your [mod target folder], it should be an empty folder.
4. You can see your mod cards in the [mod list].
If you find any problems in the above steps, please refer to [Troubleshooting].
# If There Are No Problems Above, Then
1. Left-click any mod card in the [mod list], you will find that the card will have a highlighted border with animation. This means the mod is set to the selected state.
2. You can click several mod cards, they will be added to the selected state.
3. Click the [Apply] button under the [Mods] page, the program will create virtual links for the selected mods to the [mod target folder].
4. Open the [mod target folder], you will find that the folder contains virtual links to the selected mods.

If you successfully complete the above steps, congratulations, you have successfully loaded the mods.
Then the mod loader will read the mods in the [mod target folder] and load them into the game.
`;

const configContentEn =
  `# Mod Information
Mods are displayed as cards in the [mod list], and we hope to add more information to them for better management.
The program adds the following information to each mod:
1. Character (a tag used by the program to filter mods, it may not necessarily be a character, it can be other tags)
2. Shortcut key
3. Description
4. Preview image
# Edit Mod Information
1. After left-clicking the mod card in the [mod list], you will see an [Edit] button at the bottom of the detailed information bar on the right. Click it to pop up the mod information editing window.
2. Right-clicking the mod card in the [mod list] will directly pop up the mod information editing window.
# Change Mod Preview Image
In addition to clicking the + sign on the right side of the [mod preview image] in the mod information editing window to change the mod preview image, you can also directly drag the image to the mod card to change the mod preview image.
1. Drag a local image to the mod card in the [mod list] to change the mod preview image.
2. Drag an image from the browser page to the mod card in the [mod list] to change the mod preview image.

I highly recommend using the method of dragging images from the browser to change the mod preview image, as this allows you to directly use the preview images provided on the mod website.
`;

const presetContentEn =
  `# Preset Function
The program provides a preset function, which allows you to quickly switch the enable/disable status of a group of mods.

On the left side of the [Mods] page, you can see the preset selection list. You can switch presets by clicking the presets in the preset selection list.
At the beginning, the program should have a default preset.
# Add Preset
1. Click the "+" add preset button at the bottom right of the preset list on the left side of the [Mods] page, a new preset window will pop up.
2. In the new preset window, enter the name of the preset, and then click [OK].
3. You will find a new preset in the preset list.
# Delete Preset
1. Click the menu (☰) button at the bottom right of the preset list on the left side of the [Mods] page, the folder where the presets are stored will pop up.
2. Then you can delete the preset files in the preset folder to delete the presets.
---
# Default Preset
The default preset is a preset that comes with the program, you cannot delete it, and it will not record the enable/disable status of any mods.
When switching to the default preset, the program will switch all mods to the disabled state.
If you want to save the current mod enable/disable status, please create a new preset.

When you want to test a single mod or exclude the impact of a mod on the game, it will be your good helper.
`;

const autoContentEn =
  `# Automation
"Every time I start the game, I have to open the mod loader and this program, and then start the game. This is too troublesome!"
"After changing the mod, I still need to manually refresh the mod loader. This is too troublesome!"
"I want to start the game and mod loader with one click!"
"I want to refresh the mod in the game!"

If you have the above troubles, you can try using the automation function of the program. It currently exists as a plugin, and you can find it on the [Settings] page.
---
# Configure Auto Start
1. Open the [Settings] page.
2. Find the configuration item of the [Auto Start Plugin].
3. Set the path of the plugin according to the prompt.
4. Click the [Start Mod Loader] and [Start Game] buttons to test whether the mod loader and game can be started normally.

If configured correctly, the program will automatically start the mod loader and game every time you open this program.
# Configure Auto Refresh
1. Open the [Settings] page.
2. Find the configuration item of [In-Game Refresh].
3. Turn on the [Refresh After Applying] switch.
4. Configure the [Process Name] and [Virtual Key Value for Refresh] according to the prompt.

1. The process name is the process name of your game, which you can view through the task manager. For Zenless Zone Zero, the process name is "ZenlessZoneZero.exe".
2. The virtual key value for refresh is the virtual key value of the shortcut key used by your mod loader to refresh mods. You can search online for the "virtual key value table" to find the virtual key value of the refresh shortcut key of your mod loader. Generally, the refresh shortcut key is F10, and the corresponding virtual key value is 121.
`;

const multipleGamesContentEn =
  `# Multi-Game Support
By using local configuration instead of global configuration, you can create multiple configurations for different games to set mod loaders, mod source folders, mod target folders, etc.

# Create Local Configuration
1. Open the [Settings] page.
2. Find the [Switch Configuration] page.
3. Select the path of [Save As], it should be an empty folder, and then click Create Shortcut.

After that, when you open the program by creating a shortcut on the desktop, the program will load the local configuration you selected, instead of the global configuration.

# Advanced Usage
If you know basic command line knowledge, using local configuration is actually providing startup parameters when XXMM starts:

'xx mod manager.exe' --customConfig 'path to your local configuration folder'

You can try using bat or other programs to start the program by setting startup parameters, so as to achieve automation in other applications.
`;

const troubleContentEn =
  `# Troubleshooting
When you encounter problems, you can try the following methods to solve them:
1. Reopen the program
2. Refer to the [Help] page
3. Check if it is a problem with the mod loader, try starting the mod loader separately and copying the mod to the mod loader's Mods folder

If you know some front-end development, you can try pressing Ctrl+Shift+I to open the developer tools and check for error messages.
If you cannot solve the problem, please contact me.
`;

import { g_config_vue } from '../../electron/IManager';

const language = g_config_vue.language;
watch(language, (newVal, oldVal) => {
  setTranslatedTabs(newVal);
});

// 重新编排tab内容和顺序
// 1. 名词解释
// 2. 导入mod
// 3. 配置mod加载器
// 4. 加载mod
// 5. 配置mod
// 6. 预设
// 7. 自动化
// 8. 适配多个游戏
// 9. 故障排除
const tabs = ['help-explain', 'help-import', 'help-config-mod-loader', 'help-load', 'help-config', 'help-preset', 'help-auto', 'help-multiple-games', 'help-trouble'];

const currentTab = ref(tabs[0]);
const handleTabChange = (tab) => {
  currentTab.value = tab;
};

const translatedTabs = ref(['Overview', 'Importing Mods', 'Loader Config', 'Load Mods', 'Mods Config', 'Presets', 'Automation', 'Multi-Game Support', 'Troubleshooting']);
const setTranslatedTabs = (language) =>{
  if (language === 'vi') {
    translatedTabs.value = ['Tổng quan', 'Nhập mod', 'Cấu hình trình tải', 'Tải mod', 'Cấu hình mod', 'Preset', 'Tự động hóa', 'Hỗ trợ nhiều game', 'Khắc phục sự cố'];
  } else {
    translatedTabs.value = ['Overview', 'Importing Mods', 'Loader Config', 'Load Mods', 'Mods Config', 'Presets', 'Automation', 'Multi-Game Support', 'Troubleshooting'];
  }
}

onMounted(() => {
  setTranslatedTabs(language.value);
});

</script>

<style scoped>
#help-section {
  display: flex;
  flex-direction: row;
  height: calc(100% - 60px);
  width: 100%;
  overflow: display;
}

.help-content {
  margin: 0 10px;
  height: calc(100% - 20px);
  /* width: calc(100% - 200px); */
  flex: 1;

  >div {
    padding-right: 10px;
  }
}
</style>