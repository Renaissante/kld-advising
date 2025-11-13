# Use PHP 8.2 with Apache
FROM php:8.2-apache

# Install PostgreSQL PDO extension and other dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    unzip \
    git \
    && docker-php-ext-install pdo_pgsql pdo \
    && a2enmod rewrite

# Set working directory
WORKDIR /var/www/html/

# Copy backend files (including composer.json & composer.lock)
COPY backend/ /var/www/html/
COPY composer.json composer.lock /var/www/html/

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Expose port 80
EXPOSE 80

# Start Apache in the foreground
CMD ["apache2-foreground"]
