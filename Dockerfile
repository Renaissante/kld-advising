# Use PHP 8.2 CLI (not Apache)
FROM php:8.2-cli

# Install PostgreSQL PDO extension and other dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    unzip \
    git \
    && docker-php-ext-install pdo_pgsql pdo

WORKDIR /app

# Copy all files
COPY backend/ /app/backend/
COPY composer.json composer.lock /app/

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Enable error display for debugging
RUN echo "display_errors = On" > /usr/local/etc/php/php.ini && \
    echo "error_reporting = E_ALL" >> /usr/local/etc/php/php.ini && \
    echo "log_errors = On" >> /usr/local/etc/php/php.ini

EXPOSE 8080

# Default command (Railway's Procfile will override this)
CMD ["php", "-S", "0.0.0.0:8080", "-t", "backend"]