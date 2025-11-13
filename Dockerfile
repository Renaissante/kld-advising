# Use PHP 8.2 with Apache
FROM php:8.2-apache

# Install dependencies and PostgreSQL PDO extension
RUN apt-get update && apt-get install -y \
    libpq-dev \
    unzip \
    git \
    && docker-php-ext-install pdo_pgsql \
    && docker-php-ext-install pdo

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Copy backend files into Apache document root
COPY backend/ /var/www/html/

# Set working directory
WORKDIR /var/www/html/

# Copy composer.json and install PHP dependencies
COPY composer.json /var/www/html/
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --optimize-autoloader

# Expose port 80
EXPOSE 80

# Start Apache in the foreground
CMD ["apache2-foreground"]
