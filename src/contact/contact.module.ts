import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { ContactAdminController } from './contact-admin.controller';

@Module({
  controllers: [ContactController, ContactAdminController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
