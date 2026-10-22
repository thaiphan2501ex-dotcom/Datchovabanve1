# Bước 1: Lấy một hệ điều hành Ubuntu Linux hoàn toàn trống
FROM ubuntu:22.04

# Bước 2: Khai báo để hệ điều hành không hỏi các popup cấu hình linh tinh lúc cài đặt
ENV DEBIAN_FRONTEND=noninteractive

# Bước 3: Cập nhật hệ thống và cài đặt các công cụ cơ bản (curl để tải file)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Bước 4: Tải và cài đặt Node.js phiên bản 18 từ máy chủ chính thức của Node.js
# (Thầy hỏi thì bảo đoạn này tương đương việc lên mạng tải file .exe về cài trên Windows)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Bước 5: Tạo một thư mục làm việc tên là /app bên trong container
WORKDIR /app

# Bước 6: Copy file package.json vào và cài đặt các thư viện (express, mysql2)
COPY package*.json ./
RUN npm install

# Bước 7: Copy toàn bộ code server.js của mình vào
COPY . .

# Bước 8: Mở cổng 5000 để giao tiếp ra bên ngoài
EXPOSE 5000

# Bước 9: Lệnh cuối cùng để khởi động server (giống như việc mình gõ lệnh trong terminal)
CMD ["node", "server.js"]