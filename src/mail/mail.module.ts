import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { OrderMailService } from './order-mail.service';

@Module({
  providers: [MailService, OrderMailService],
  exports: [MailService, OrderMailService],
})
export class MailModule {}
